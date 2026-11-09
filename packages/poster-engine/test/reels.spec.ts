import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cropPortrait, renderPosterSet } from '../src/index.js';
import type { MatchConfiguration, Player, PosterSetDefinition } from '../src/types.js';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repositoryRoot = resolve(packageRoot, '../..');
const fixturePath = resolve(repositoryRoot, 'tests/fixtures/matches/barbarians-reels-demo.json');
const templateRoot = resolve(repositoryRoot, 'tests/fixtures/templates/barbarians/v5');
const layoutRoot = resolve(packageRoot, 'layouts/barbarians/v5');

let outputRoot: string;
let match: MatchConfiguration;

function resolvePlayers(players: Player[]): Player[] {
  return players.map((player) => ({
    ...player,
    photoPath: player.photoPath ? resolve(repositoryRoot, player.photoPath) : undefined,
  }));
}

beforeAll(async () => {
  outputRoot = await mkdtemp(resolve(tmpdir(), 'squadpost-reels-'));
  const parsed = JSON.parse(await readFile(fixturePath, 'utf8')) as MatchConfiguration;
  match = {
    ...parsed,
    starters: resolvePlayers(parsed.starters),
    finishers: resolvePlayers(parsed.finishers),
  };
});

afterAll(async () => {
  await rm(outputRoot, { recursive: true, force: true });
});

describe('configuration de démonstration avec les joueurs réels', () => {
  it('respecte la répartition, les numéros et les libellés provisoires', () => {
    const players = [...match.starters, ...match.finishers];

    expect(match.starters).toHaveLength(10);
    expect(match.finishers).toHaveLength(5);
    expect(players.map((player) => player.jerseyNumber)).toEqual([
      1, 2, 3, 4, 5, 9, 10, 12, 13, 14, 16, 17, 18, 19, 20,
    ]);
    expect(players.map((player) => player.name)).toEqual(
      Array.from({ length: 15 }, (_, index) => `JOUEUR ${String(index + 1).padStart(2, '0')}`),
    );
  });

  it('utilise uniquement des PNG transparents en cadrage non destructif', async () => {
    const players = [...match.starters, ...match.finishers];

    for (const player of players) {
      expect(player.photoPath).toMatch(/\.png$/u);
      expect(player.crop).toMatchObject({
        fit: 'contain',
        containPosition: 'bottom',
        trimTransparent: true,
      });
      expect((await sharp(player.photoPath).metadata()).hasAlpha).toBe(true);
    }
  });

  it('préserve les proportions en mode contain', async () => {
    const sourcePath = resolve(outputRoot, 'source.png');
    await sharp({
      create: { width: 80, height: 160, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        {
          input: { create: { width: 40, height: 100, channels: 4, background: '#ffffff' } },
          left: 20,
          top: 30,
        },
      ])
      .png()
      .toFile(sourcePath);

    const result = await cropPortrait(sourcePath, 200, 120, {
      fit: 'contain',
      containPosition: 'bottom',
      trimTransparent: true,
    });
    const { data, info } = await sharp(result)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const opaquePixels: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        if ((data[(y * info.width + x) * 4 + 3] ?? 0) > 0) opaquePixels.push({ x, y });
      }
    }
    const xs = opaquePixels.map(({ x }) => x);
    const ys = opaquePixels.map(({ y }) => y);
    const visibleWidth = Math.max(...xs) - Math.min(...xs) + 1;
    const visibleHeight = Math.max(...ys) - Math.min(...ys) + 1;

    expect(visibleWidth / visibleHeight).toBeCloseTo(0.4, 1);
    expect(Math.max(...ys)).toBe(119);
  });

  it('génère successivement les deux affiches en 1080 × 1350', async () => {
    const definitions: PosterSetDefinition[] = [
      ['starters', 'titulaires'],
      ['finishers', 'finisseurs'],
    ].map(([kind, name]) => ({
      kind: kind as 'starters' | 'finishers',
      manifestPath: resolve(layoutRoot, `${name}.json`),
      backgroundPath: resolve(templateRoot, `${name}.png`),
      outputPath: resolve(outputRoot, `${name}.png`),
    }));

    const outputs = await renderPosterSet(match, definitions);
    expect(outputs).toHaveLength(2);
    for (const output of outputs) {
      expect(await sharp(output).metadata()).toMatchObject({
        width: 1080,
        height: 1350,
        format: 'png',
      });
    }
  });
});
