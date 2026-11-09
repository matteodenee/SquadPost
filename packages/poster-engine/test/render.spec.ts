import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  calculateCoverCrop,
  cropPortrait,
  loadManifest,
  renderLayoutDiagnostic,
  renderCropDiagnostic,
  renderPoster,
  renderPosterComparison,
  renderPosterSet,
} from '../src/index.js';
import { prepareDemoLogos } from '../src/demo-assets.js';
import type {
  LayoutManifest,
  MatchConfiguration,
  PosterKind,
  PosterSetDefinition,
  Rect,
} from '../src/types.js';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repositoryRoot = resolve(packageRoot, '../..');
const templateRoot = resolve(repositoryRoot, 'tests/fixtures/templates/barbarians/v5');
const layoutRoot = resolve(packageRoot, 'layouts/barbarians/v5');
const fixturePath = resolve(repositoryRoot, 'tests/fixtures/matches/barbarians-demo.json');
const playerRoot = resolve(repositoryRoot, 'tests/fixtures/players');
const fileNames: Record<PosterKind, string> = {
  starters: 'titulaires',
  finishers: 'finisseurs',
  presentation: 'presentation',
};

let outputRoot: string;
let match: MatchConfiguration;
let jpegMatch: MatchConfiguration;
let definitions: PosterSetDefinition[];
const manifests = new Map<PosterKind, LayoutManifest>();

async function rawRgb(input: string | Buffer) {
  return sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
}

function isInside(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

function allowedRects(manifest: LayoutManifest): Rect[] {
  return [
    ...manifest.playerSlots.flatMap((slot) => [
      slot.photo,
      slot.frame ?? slot.photo,
      slot.number?.box ?? slot.photo,
      slot.name,
    ]),
    ...(manifest.graphicRegions ?? []).map((region) => region.box),
    ...(manifest.protectedRegions ?? []).map((region) => region.box),
    ...(manifest.imageSlots ?? []).map((slot) => slot.box),
    ...manifest.fieldSlots.map((slot) => slot.box),
  ];
}

function changedPixelCount(before: Buffer, after: Buffer, width: number, rect: Rect): number {
  let changed = 0;
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      const offset = (y * width + x) * 3;
      if (
        before[offset] !== after[offset] ||
        before[offset + 1] !== after[offset + 1] ||
        before[offset + 2] !== after[offset + 2]
      ) {
        changed += 1;
      }
    }
  }
  return changed;
}

beforeAll(async () => {
  outputRoot = await mkdtemp(resolve(tmpdir(), 'squadpost-v5-'));
  const parsed = JSON.parse(await readFile(fixturePath, 'utf8')) as MatchConfiguration;
  jpegMatch = {
    ...parsed,
    starters: parsed.starters.map((player) => ({
      ...player,
      photoPath: player.photoPath ? resolve(repositoryRoot, player.photoPath) : undefined,
    })),
    finishers: parsed.finishers.map((player) => ({
      ...player,
      photoPath: player.photoPath ? resolve(repositoryRoot, player.photoPath) : undefined,
    })),
    images: await prepareDemoLogos(
      resolve(repositoryRoot, 'tests/fixtures/templates/barbarians/v2/presentation.png'),
      resolve(outputRoot, 'assets'),
    ),
  };
  match = {
    ...jpegMatch,
    starters: jpegMatch.starters.map((player) => ({
      ...player,
      photoPath: player.photoPath
        ? resolve(
            playerRoot,
            'detoures',
            `${basename(player.photoPath, extname(player.photoPath))}.png`,
          )
        : undefined,
    })),
    finishers: jpegMatch.finishers.map((player) => ({
      ...player,
      photoPath: player.photoPath
        ? resolve(
            playerRoot,
            'detoures',
            `${basename(player.photoPath, extname(player.photoPath))}.png`,
          )
        : undefined,
    })),
  };

  definitions = (['starters', 'finishers', 'presentation'] as PosterKind[]).map((kind) => ({
    kind,
    manifestPath: resolve(layoutRoot, `${fileNames[kind]}.json`),
    backgroundPath: resolve(templateRoot, `${fileNames[kind]}.png`),
    outputPath: resolve(outputRoot, `${fileNames[kind]}.png`),
  }));
  for (const definition of definitions) {
    manifests.set(definition.kind, await loadManifest(definition.manifestPath));
  }
  await renderPosterSet(match, definitions);
});

afterAll(async () => {
  await rm(outputRoot, { recursive: true, force: true });
});

describe('Barbarians v5 visual rendering', () => {
  it('generates three valid Instagram PNG files from one match configuration', async () => {
    for (const definition of definitions) {
      const metadata = await sharp(definition.outputPath).metadata();
      expect({ format: metadata.format, width: metadata.width, height: metadata.height }).toEqual({
        format: 'png',
        width: 1080,
        height: 1350,
      });
    }
  });

  it('prioritizes the fifteen detached PNG portraits used by the posters', () => {
    const selectedPlayers = [...match.starters, ...match.finishers];
    expect(selectedPlayers).toHaveLength(15);
    expect(selectedPlayers.every((player) => player.photoPath?.endsWith('.png'))).toBe(true);
    expect(selectedPlayers.every((player) => player.photoPath?.includes('/detoures/'))).toBe(true);
  });

  it('uses exactly ten starters and five finishers with the requested jersey numbers', () => {
    expect(manifests.get('starters')?.playerSlots).toHaveLength(10);
    expect(manifests.get('finishers')?.playerSlots).toHaveLength(5);
    expect(match.starters.map((player) => player.jerseyNumber)).toEqual([
      1, 2, 3, 4, 5, 9, 10, 12, 13, 14,
    ]);
    expect(match.finishers.map((player) => player.jerseyNumber)).toEqual([16, 17, 18, 19, 20]);
  });

  it('rejects a composition whose player count is incompatible with the manifest', async () => {
    const definition = definitions.find((item) => item.kind === 'starters');
    const manifest = manifests.get('starters');
    expect(definition).toBeDefined();
    expect(manifest).toBeDefined();
    if (!definition || !manifest) return;

    await expect(
      renderPoster({
        manifest,
        backgroundPath: definition.backgroundPath,
        match: { ...match, starters: match.starters.slice(0, 9) },
        outputPath: resolve(outputRoot, 'invalid.png'),
      }),
    ).rejects.toThrow('requires exactly 10 players');
  });

  it('keeps a missing-photo slot clean while retaining its frame, number and name', async () => {
    const definition = definitions.find((item) => item.kind === 'starters');
    const manifest = manifests.get('starters');
    expect(definition).toBeDefined();
    expect(manifest).toBeDefined();
    if (!definition || !manifest) return;

    const missingIndex = 5;
    const missingOutput = resolve(outputRoot, 'missing-photo.png');
    const missingPlayers = match.starters.map((player, index) =>
      index === missingIndex ? { ...player, photoPath: undefined } : player,
    );
    await renderPoster({
      manifest,
      backgroundPath: definition.backgroundPath,
      match: { ...match, starters: missingPlayers },
      outputPath: missingOutput,
    });

    const normalizedBackground = await sharp(definition.backgroundPath)
      .resize(1080, 1350, {
        fit: manifest.sourceCanvas?.fit ?? 'cover',
        position: 'centre',
      })
      .png()
      .toBuffer();
    const before = await rawRgb(normalizedBackground);
    const after = await rawRgb(missingOutput);
    const slot = manifest.playerSlots[missingIndex];
    expect(slot).toBeDefined();
    if (!slot) return;
    const safeInterior = {
      x: slot.photo.x + 25,
      y: slot.photo.y + 65,
      width: slot.photo.width - 50,
      height: slot.photo.height - 75,
    };
    expect(changedPixelCount(before.data, after.data, before.info.width, safeInterior)).toBe(0);
    expect(
      changedPixelCount(before.data, after.data, before.info.width, slot.name),
    ).toBeGreaterThan(500);
  });

  it('changes no decoded background pixel outside manifest-authorized zones', async () => {
    for (const definition of definitions) {
      const manifest = manifests.get(definition.kind);
      expect(manifest).toBeDefined();
      if (!manifest) continue;
      const normalizedBackground = await sharp(definition.backgroundPath)
        .resize(1080, 1350, {
          fit: manifest.sourceCanvas?.fit ?? 'cover',
          position: 'centre',
        })
        .png()
        .toBuffer();
      const before = await rawRgb(normalizedBackground);
      const after = await rawRgb(definition.outputPath);
      const rects = allowedRects(manifest);
      let unexpectedChanges = 0;

      for (let y = 0; y < 1350; y += 1) {
        for (let x = 0; x < 1080; x += 1) {
          if (rects.some((rect) => isInside(rect, x, y))) continue;
          const offset = (y * 1080 + x) * 3;
          if (
            before.data[offset] !== after.data[offset] ||
            before.data[offset + 1] !== after.data[offset + 1] ||
            before.data[offset + 2] !== after.data[offset + 2]
          ) {
            unexpectedChanges += 1;
          }
        }
      }
      expect({ kind: definition.kind, unexpectedChanges }).toEqual({
        kind: definition.kind,
        unexpectedChanges: 0,
      });
    }
  });

  it('uses the presentation background without cleanup panels or ghost text', async () => {
    const definition = definitions.find((item) => item.kind === 'presentation');
    const manifest = manifests.get('presentation');
    expect(definition).toBeDefined();
    expect(manifest).toBeDefined();
    if (!definition || !manifest) return;

    expect(manifest.graphicRegions ?? []).toHaveLength(0);
    const normalizedBackground = await sharp(definition.backgroundPath)
      .resize(1080, 1350, {
        fit: manifest.sourceCanvas?.fit ?? 'cover',
        position: 'centre',
      })
      .png()
      .toBuffer();
    const before = await rawRgb(normalizedBackground);
    const after = await rawRgb(definition.outputPath);
    const variableZones = [
      ...(manifest.imageSlots ?? []).map((slot) => slot.box),
      ...manifest.fieldSlots.map((slot) => slot.box),
    ];
    for (const region of variableZones) {
      expect(changedPixelCount(before.data, after.data, before.info.width, region)).toBeGreaterThan(
        100,
      );
    }
  });

  it('adds only text to the existing number badges and name banners', () => {
    for (const kind of ['starters', 'finishers'] as const) {
      const manifest = manifests.get(kind);
      expect(manifest).toBeDefined();
      for (const slot of manifest?.playerSlots ?? []) {
        expect(slot.frame).toBeUndefined();
        expect(slot.number?.renderMode).toBe('text-only');
        expect(slot.name.banner).toBeUndefined();
        expect(slot.name.renderMode).toBe('text-only');
      }
      expect(manifest?.protectedRegions).toHaveLength(manifest?.playerSlots.length ?? 0);
    }
  });

  it('restores the original badge artwork above portraits before writing numbers', async () => {
    for (const kind of ['starters', 'finishers'] as const) {
      const definition = definitions.find((item) => item.kind === kind);
      const manifest = manifests.get(kind);
      expect(definition).toBeDefined();
      expect(manifest).toBeDefined();
      if (!definition || !manifest) continue;

      const withoutNumbers: LayoutManifest = {
        ...manifest,
        playerSlots: manifest.playerSlots.map((slot) => ({ ...slot, number: undefined })),
      };
      const output = resolve(outputRoot, `${kind}-protected-artwork.png`);
      await renderPoster({
        manifest: withoutNumbers,
        backgroundPath: definition.backgroundPath,
        match,
        outputPath: output,
      });
      const before = await rawRgb(definition.backgroundPath);
      const after = await rawRgb(output);
      for (const region of manifest.protectedRegions ?? []) {
        expect(changedPixelCount(before.data, after.data, before.info.width, region.box)).toBe(0);
      }
    }
  });

  it('uses native-size backgrounds without any resizing mode', () => {
    for (const manifest of manifests.values()) {
      expect(manifest.canvas).toEqual({ width: 1080, height: 1350 });
      expect(manifest.sourceCanvas).toBeUndefined();
    }
  });

  it('keeps every declared player zone inside the output canvas', () => {
    for (const kind of ['starters', 'finishers'] as const) {
      const manifest = manifests.get(kind);
      for (const slot of manifest?.playerSlots ?? []) {
        for (const rect of [slot.photo, slot.number?.box, slot.name]) {
          expect(rect).toBeDefined();
          if (!rect) continue;
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width).toBeLessThanOrEqual(1080);
          expect(rect.y + rect.height).toBeLessThanOrEqual(1350);
        }
      }
    }
  });

  it('produces diagnostic PNGs containing every declared placement zone', async () => {
    for (const definition of definitions) {
      const manifest = manifests.get(definition.kind);
      expect(manifest).toBeDefined();
      if (!manifest) continue;
      const output = resolve(outputRoot, `diagnostic-${fileNames[definition.kind]}.png`);
      await renderLayoutDiagnostic(definition.backgroundPath, manifest, output);
      const metadata = await sharp(output).metadata();
      expect({ width: metadata.width, height: metadata.height }).toEqual({
        width: 1080,
        height: 1350,
      });
    }
  });

  it('produces a visual comparison of three crop settings', async () => {
    const output = resolve(outputRoot, 'diagnostic-cadrages.png');
    await renderCropDiagnostic(resolve(playerRoot, 'joueur_03.jpg'), output);
    const metadata = await sharp(output).metadata();
    expect({ width: metadata.width, height: metadata.height }).toEqual({
      width: 900,
      height: 260,
    });
  });

  it('produces side-by-side detached PNG and original JPG comparisons', async () => {
    const starterDefinition = definitions.find((definition) => definition.kind === 'starters');
    const starterManifest = manifests.get('starters');
    expect(starterDefinition).toBeDefined();
    expect(starterManifest).toBeDefined();
    if (!starterDefinition || !starterManifest) return;

    const jpegOutput = resolve(outputRoot, 'titulaires-jpg.png');
    await renderPoster({
      manifest: starterManifest,
      backgroundPath: starterDefinition.backgroundPath,
      match: jpegMatch,
      outputPath: jpegOutput,
    });
    const comparison = resolve(outputRoot, 'comparaison-titulaires.png');
    await renderPosterComparison(starterDefinition.outputPath, jpegOutput, comparison);
    const metadata = await sharp(comparison).metadata();
    expect({ width: metadata.width, height: metadata.height }).toEqual({
      width: 2160,
      height: 1410,
    });
    const detachedPixels = await rawRgb(starterDefinition.outputPath);
    const jpegPixels = await rawRgb(jpegOutput);
    expect(
      changedPixelCount(
        detachedPixels.data,
        jpegPixels.data,
        detachedPixels.info.width,
        starterManifest.playerSlots[0]?.photo ?? { x: 0, y: 0, width: 1, height: 1 },
      ),
    ).toBeGreaterThan(1000);
  });
});

describe('portrait framing', () => {
  it('keeps source proportions while applying focal point and zoom', () => {
    const crop = calculateCoverCrop(303, 252, 192, 127, { x: 0.78, y: 0.35, zoom: 1.2 });
    expect(crop.left).toBeGreaterThanOrEqual(0);
    expect(crop.top).toBeGreaterThanOrEqual(0);
    expect(crop.left + crop.width).toBeLessThanOrEqual(303);
    expect(crop.top + crop.height).toBeLessThanOrEqual(252);
    expect(Math.abs(crop.width / crop.height - 192 / 127)).toBeLessThan(0.015);
  });

  it('supports independent zoom and normalized offsets without leaving source bounds', () => {
    const centered = calculateCoverCrop(303, 252, 247, 197, {
      focalPoint: { x: 0.5, y: 0.42 },
      zoom: 1,
    });
    const adjusted = calculateCoverCrop(303, 252, 247, 197, {
      focalPoint: { x: 0.5, y: 0.42 },
      zoom: 1.25,
      offsetX: 0.15,
      offsetY: -0.1,
    });
    expect(adjusted.width).toBeLessThan(centered.width);
    expect(adjusted.height).toBeLessThan(centered.height);
    expect(adjusted).not.toEqual(centered);
    expect(adjusted.left + adjusted.width).toBeLessThanOrEqual(303);
    expect(adjusted.top + adjusted.height).toBeLessThanOrEqual(252);
  });

  it('produces visibly different crops for several settings on the same player', async () => {
    const source = resolve(playerRoot, 'joueur_03.jpg');
    const crops = await Promise.all([
      cropPortrait(source, 247, 197, { zoom: 1 }),
      cropPortrait(source, 247, 197, { zoom: 1.2, offsetX: 0.1 }),
      cropPortrait(source, 247, 197, { zoom: 1.2, offsetY: -0.1 }),
    ]);
    expect(crops[0]?.equals(crops[1] ?? Buffer.alloc(0))).toBe(false);
    expect(crops[1]?.equals(crops[2] ?? Buffer.alloc(0))).toBe(false);
  });

  it('handles differently sized JPEG portraits without stretching', async () => {
    const sourcePaths = ['joueur_01.jpg', 'joueur_06.jpg', 'joueur_16.jpg'];
    const sourceSizes = await Promise.all(
      sourcePaths.map(async (name) => {
        const metadata = await sharp(resolve(playerRoot, name)).metadata();
        return `${metadata.width}x${metadata.height}`;
      }),
    );
    expect(new Set(sourceSizes).size).toBeGreaterThan(1);

    for (const name of sourcePaths) {
      const portrait = await cropPortrait(resolve(playerRoot, name), 192, 127);
      const metadata = await sharp(portrait).metadata();
      expect({ width: metadata.width, height: metadata.height }).toEqual({
        width: 192,
        height: 127,
      });
    }
  });

  it('preserves the alpha channel of a prepared transparent PNG portrait', async () => {
    const transparentPath = resolve(outputRoot, 'transparent-portrait.png');
    const rgba = Buffer.alloc(100 * 120 * 4);
    for (let pixel = 0; pixel < 100 * 120; pixel += 1) {
      rgba[pixel * 4] = 40;
      rgba[pixel * 4 + 1] = 140;
      rgba[pixel * 4 + 2] = 220;
      rgba[pixel * 4 + 3] = pixel % 100 < 50 ? 255 : 0;
    }
    await sharp(rgba, { raw: { width: 100, height: 120, channels: 4 } })
      .png()
      .toFile(transparentPath);
    const portrait = await cropPortrait(transparentPath, 192, 127);
    const { data, info } = await sharp(portrait)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const alpha = Array.from(
      { length: info.width * info.height },
      (_, index) => data[index * 4 + 3] ?? 255,
    );
    expect(Math.min(...alpha)).toBe(0);
    expect(Math.max(...alpha)).toBe(255);
  });

  it('confirms that all twenty detached fixtures contain useful transparency', async () => {
    for (let index = 1; index <= 20; index += 1) {
      const name = `joueur_${String(index).padStart(2, '0')}.png`;
      const { data, info } = await sharp(resolve(playerRoot, 'detoures', name))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const alpha = Array.from(
        { length: info.width * info.height },
        (_, pixel) => data[pixel * 4 + 3] ?? 255,
      );
      expect(Math.min(...alpha), name).toBe(0);
      expect(Math.max(...alpha), name).toBe(255);
    }
  });
});
