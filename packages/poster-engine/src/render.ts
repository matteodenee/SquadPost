import { access, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import sharp, { type OverlayOptions } from 'sharp';

import { cropPortrait } from './crop.js';
import { loadManifest } from './manifest.js';
import { createTextPlateSvg } from './text.js';
import type {
  BannerStyle,
  CropSettings,
  FrameStyle,
  GraphicRegion,
  LayoutManifest,
  MatchConfiguration,
  NumberStyle,
  PhotoMask,
  Player,
  PosterSetDefinition,
  Rect,
  RenderPosterOptions,
  TextStyle,
} from './types.js';

type SharpOverlay = OverlayOptions;
type LayerName = NonNullable<LayoutManifest['layerOrder']>[number];

const defaultLayerOrder: LayerName[] = [
  'graphicRegions',
  'photos',
  'protections',
  'frames',
  'numbers',
  'nameBanners',
  'names',
  'images',
  'fields',
];

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function prepareBackground(
  backgroundPath: string,
  manifest: LayoutManifest,
): Promise<Buffer> {
  const metadata = await sharp(backgroundPath).metadata();
  const expected = manifest.sourceCanvas ?? manifest.canvas;
  if (metadata.width !== expected.width || metadata.height !== expected.height) {
    throw new Error(
      `Background dimensions ${metadata.width}x${metadata.height} do not match manifest source canvas ${expected.width}x${expected.height}.`,
    );
  }

  if (expected.width === manifest.canvas.width && expected.height === manifest.canvas.height) {
    return sharp(backgroundPath).png().toBuffer();
  }

  return sharp(backgroundPath)
    .resize(manifest.canvas.width, manifest.canvas.height, {
      fit: manifest.sourceCanvas?.fit ?? 'cover',
      position: 'centre',
    })
    .png()
    .toBuffer();
}

async function createPhotoAlphaMask(
  background: Buffer,
  box: Rect,
  mask: PhotoMask,
): Promise<Buffer> {
  if (mask.mode === 'rounded-rectangle') {
    const cutouts = (mask.cutouts ?? [])
      .map(
        (cutout) =>
          `<rect x="${cutout.x}" y="${cutout.y}" width="${cutout.width}" height="${cutout.height}" rx="${Math.min(cutout.width, cutout.height) / 4}" fill="black" />`,
      )
      .join('');
    return Buffer.from(`
      <svg width="${box.width}" height="${box.height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${box.width}" height="${box.height}" rx="${mask.cornerRadius}" fill="white" />
        ${cutouts}
      </svg>
    `);
  }

  const { data, info } = await sharp(background)
    .extract({ left: box.x, top: box.y, width: box.width, height: box.height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = Buffer.alloc(box.width * box.height);

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    const offset = pixel * info.channels;
    const red = data[offset] ?? 0;
    const green = data[offset + 1] ?? 0;
    const blue = data[offset + 2] ?? 0;
    const minimum = Math.min(red, green, blue);
    const maximum = Math.max(red, green, blue);
    const luminance = (red + green + blue) / 3;
    alpha[pixel] =
      maximum - minimum <= mask.maxChannelDelta &&
      luminance >= mask.minLuminance &&
      luminance <= mask.maxLuminance
        ? 255
        : 0;
  }

  return sharp(alpha, { raw: { width: box.width, height: box.height, channels: 1 } })
    .png()
    .toBuffer();
}

async function createPlayerPhotoOverlay(
  background: Buffer,
  player: Player,
  photo: Rect & { mask: PhotoMask; cropDefaults?: CropSettings },
): Promise<SharpOverlay | undefined> {
  if (!player.photoPath || !(await fileExists(player.photoPath))) return undefined;

  const cropSettings: CropSettings | undefined = player.crop
    ? {
        ...photo.cropDefaults,
        ...player.crop,
        focalPoint: player.crop.focalPoint ?? photo.cropDefaults?.focalPoint,
      }
    : player.focalPoint
      ? {
          ...photo.cropDefaults,
          zoom: player.focalPoint.zoom ?? photo.cropDefaults?.zoom,
          focalPoint: { x: player.focalPoint.x, y: player.focalPoint.y },
        }
      : photo.cropDefaults;
  const portrait = await cropPortrait(player.photoPath, photo.width, photo.height, cropSettings);
  const alphaMask = await createPhotoAlphaMask(background, photo, photo.mask);
  const clippedPortrait = await sharp(portrait)
    .composite([{ input: alphaMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  return { input: clippedPortrait, left: photo.x, top: photo.y };
}

function createFrameSvg(width: number, height: number, style: FrameStyle): Buffer {
  const inset = style.strokeWidth / 2;
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${inset}" y="${inset}" width="${width - style.strokeWidth}" height="${height - style.strokeWidth}"
        rx="${style.cornerRadius}" fill="none" stroke="${style.color}" stroke-width="${style.strokeWidth}" />
    </svg>
  `);
}

function createNumberSvg(value: number, style: NumberStyle): Buffer {
  const { width, height } = style.box;
  const borderWidth = style.borderWidth ?? 0;
  const path = `M 14 ${borderWidth / 2} H ${width - 7} Q ${width - 1} ${borderWidth / 2} ${width - 3} 9 L ${width - 12} ${height - 8} Q ${width - 14} ${height - 2} ${width - 22} ${height - 2} H 9 Q 2 ${height - 2} 4 ${height - 10} L 10 9 Q 11 ${borderWidth / 2} 14 ${borderWidth / 2} Z`;
  const badge =
    style.renderMode === 'text-only'
      ? ''
      : `<path d="${path}" fill="${style.backgroundColor ?? '#062750'}" stroke="${style.borderColor ?? '#ffffff'}" stroke-width="${borderWidth}" />`;
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${badge}
      <text x="50%" y="52%" text-anchor="middle" dominant-baseline="central"
        font-family="${escapeXml(style.fontFamily)}" font-size="${style.fontSize}" font-weight="900"
        font-style="italic" fill="${style.color}">${value}</text>
    </svg>
  `);
}

function createBannerSvg(width: number, height: number, style: BannerStyle): Buffer {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <path d="M ${style.slant} 0 H ${width} L ${width - style.slant} ${height} H 0 Z" fill="${style.fill}" />
    </svg>
  `);
}

function createGraphicRegionSvg(region: GraphicRegion): Buffer {
  const borderWidth = region.borderWidth ?? 0;
  return Buffer.from(`
    <svg width="${region.box.width}" height="${region.box.height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${borderWidth / 2}" y="${borderWidth / 2}"
        width="${region.box.width - borderWidth}" height="${region.box.height - borderWidth}"
        rx="${region.cornerRadius ?? 0}" fill="${region.fill}"
        stroke="${region.borderColor ?? 'none'}" stroke-width="${borderWidth}" />
    </svg>
  `);
}

async function createLegacyTextOverlay(
  background: Buffer,
  text: string,
  box: Rect,
  style: TextStyle,
): Promise<Buffer> {
  const { data, info } = await sharp(background)
    .extract({ left: box.x, top: box.y, width: box.width, height: box.height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cleaned = Buffer.alloc(box.width * box.height * 3);
  let previousRowColor: [number, number, number] = [248, 248, 248];

  for (let y = 0; y < box.height; y += 1) {
    const candidates: Array<[number, number, number]> = [];
    for (let x = 0; x < box.width; x += 1) {
      const offset = (y * box.width + x) * info.channels;
      const color: [number, number, number] = [
        data[offset] ?? 0,
        data[offset + 1] ?? 0,
        data[offset + 2] ?? 0,
      ];
      const luminance = (color[0] + color[1] + color[2]) / 3;
      if (luminance > 185 && Math.max(...color) - Math.min(...color) < 30) {
        candidates.push(color);
      }
    }
    if (candidates.length > 0) {
      const middle = Math.floor(candidates.length / 2);
      const median = (channel: 0 | 1 | 2) =>
        candidates.map((color) => color[channel]).sort((a, b) => a - b)[middle] ?? 248;
      previousRowColor = [median(0), median(1), median(2)];
    }
    for (let x = 0; x < box.width; x += 1) {
      const offset = (y * box.width + x) * 3;
      [cleaned[offset], cleaned[offset + 1], cleaned[offset + 2]] = previousRowColor;
    }
  }

  const cleanPlate = await sharp(cleaned, {
    raw: { width: box.width, height: box.height, channels: 3 },
  })
    .png()
    .toBuffer();
  return sharp(cleanPlate)
    .composite([{ input: createTextPlateSvg(text, box.width, box.height, style, true) }])
    .png()
    .toBuffer();
}

function getPlayers(manifest: LayoutManifest, match: MatchConfiguration): Player[] {
  return manifest.playerCollection ? match[manifest.playerCollection] : [];
}

export async function renderPoster(options: RenderPosterOptions): Promise<string> {
  const background = await prepareBackground(options.backgroundPath, options.manifest);
  const players = getPlayers(options.manifest, options.match);
  if (
    options.manifest.requiredPlayerCount !== undefined &&
    players.length !== options.manifest.requiredPlayerCount
  ) {
    throw new Error(
      `Manifest ${options.manifest.id} requires exactly ${options.manifest.requiredPlayerCount} players; received ${players.length}.`,
    );
  }

  const layers = new Map<LayerName, SharpOverlay[]>(defaultLayerOrder.map((name) => [name, []]));
  for (const region of options.manifest.graphicRegions ?? []) {
    layers.get('graphicRegions')?.push({
      input: createGraphicRegionSvg(region),
      left: region.box.x,
      top: region.box.y,
    });
  }

  for (const region of options.manifest.protectedRegions ?? []) {
    const extractedArtwork = await sharp(background)
      .extract({
        left: region.box.x,
        top: region.box.y,
        width: region.box.width,
        height: region.box.height,
      })
      .png()
      .toBuffer();
    layers.get('protections')?.push({
      input: extractedArtwork,
      left: region.box.x,
      top: region.box.y,
    });
  }

  for (const slot of options.manifest.playerSlots) {
    const player = players[slot.order];
    if (player) {
      const photo = await createPlayerPhotoOverlay(background, player, slot.photo);
      if (photo) layers.get('photos')?.push(photo);
    }
    if (slot.frame) {
      layers.get('frames')?.push({
        input: createFrameSvg(slot.frame.width, slot.frame.height, slot.frame.style),
        left: slot.frame.x,
        top: slot.frame.y,
      });
    }
    if (slot.number) {
      layers.get('numbers')?.push({
        input: createNumberSvg(player?.jerseyNumber ?? slot.fixedDisplayNumber, slot.number),
        left: slot.number.box.x,
        top: slot.number.box.y,
      });
    }
    if (slot.name.banner) {
      layers.get('nameBanners')?.push({
        input: createBannerSvg(slot.name.width, slot.name.height, slot.name.banner),
        left: slot.name.x,
        top: slot.name.y,
      });
    }
    if (player) {
      const value = player.name.toLocaleUpperCase('fr-FR');
      layers.get('names')?.push({
        input: slot.name.banner
          ? createTextPlateSvg(value, slot.name.width, slot.name.height, slot.name.style, true)
          : slot.name.renderMode === 'text-only'
            ? createTextPlateSvg(value, slot.name.width, slot.name.height, slot.name.style, true)
            : await createLegacyTextOverlay(background, value, slot.name, slot.name.style),
        left: slot.name.x,
        top: slot.name.y,
      });
    }
  }

  for (const slot of options.manifest.imageSlots ?? []) {
    const path = options.match.images?.[slot.key];
    if (!path || !(await fileExists(path))) continue;
    const image = await sharp(path)
      .resize(slot.box.width, slot.box.height, {
        fit: slot.fit,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    layers.get('images')?.push({ input: image, left: slot.box.x, top: slot.box.y });
  }

  for (const slot of options.manifest.fieldSlots) {
    const value = options.match.fields[slot.key];
    if (!value) continue;
    layers.get('fields')?.push({
      input: createTextPlateSvg(
        value.toLocaleUpperCase('fr-FR'),
        slot.box.width,
        slot.box.height,
        slot.style,
        true,
      ),
      left: slot.box.x,
      top: slot.box.y,
    });
  }

  const overlays = (options.manifest.layerOrder ?? defaultLayerOrder).flatMap(
    (layer) => layers.get(layer) ?? [],
  );
  await mkdir(dirname(options.outputPath), { recursive: true });
  await sharp(background)
    .composite(overlays)
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toFile(options.outputPath);
  return options.outputPath;
}

export async function renderPosterSet(
  match: MatchConfiguration,
  definitions: PosterSetDefinition[],
): Promise<string[]> {
  const outputs: string[] = [];
  for (const definition of definitions) {
    const manifest = await loadManifest(definition.manifestPath);
    if (manifest.kind !== definition.kind) {
      throw new Error(
        `Manifest ${manifest.id} does not match requested poster kind ${definition.kind}.`,
      );
    }
    outputs.push(
      await renderPoster({
        manifest,
        backgroundPath: definition.backgroundPath,
        match,
        outputPath: definition.outputPath,
      }),
    );
  }
  return outputs;
}
