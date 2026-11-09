import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import sharp from 'sharp';

import { cropPortrait } from './crop.js';
import type { CropSettings } from './types.js';
import type { LayoutManifest, Rect } from './types.js';

type DiagnosticZone = { label: string; box: Rect; color: string };

function zoneSvg(zone: DiagnosticZone): string {
  return `<g>
    <rect x="${zone.box.x}" y="${zone.box.y}" width="${zone.box.width}" height="${zone.box.height}"
      fill="${zone.color}" fill-opacity="0.2" stroke="${zone.color}" stroke-width="2" />
    <text x="${zone.box.x + 5}" y="${zone.box.y + 16}" font-family="sans-serif" font-size="13"
      font-weight="700" fill="${zone.color}">${zone.label}</text>
  </g>`;
}

export async function renderLayoutDiagnostic(
  backgroundPath: string,
  manifest: LayoutManifest,
  outputPath: string,
): Promise<string> {
  const zones: DiagnosticZone[] = [];
  for (const slot of manifest.playerSlots) {
    zones.push({ label: `${slot.id}: photo`, box: slot.photo, color: '#24e56b' });
    zones.push({ label: `${slot.id}: nom`, box: slot.name, color: '#ffdc32' });
    if (slot.number) {
      zones.push({ label: `${slot.id}: numéro`, box: slot.number.box, color: '#ff4d5a' });
    }
  }
  for (const region of manifest.graphicRegions ?? []) {
    zones.push({ label: region.id, box: region.box, color: '#a869ff' });
  }
  for (const region of manifest.protectedRegions ?? []) {
    zones.push({ label: `protection: ${region.id}`, box: region.box, color: '#ff8b2d' });
  }
  for (const slot of manifest.imageSlots ?? []) {
    zones.push({ label: `image: ${slot.key}`, box: slot.box, color: '#ff55d6' });
  }
  for (const slot of manifest.fieldSlots) {
    zones.push({ label: `texte: ${slot.key}`, box: slot.box, color: '#35d9ff' });
  }

  const overlay = Buffer.from(`
    <svg width="${manifest.canvas.width}" height="${manifest.canvas.height}" xmlns="http://www.w3.org/2000/svg">
      ${zones.map(zoneSvg).join('')}
    </svg>
  `);
  const background = await sharp(backgroundPath)
    .resize(manifest.canvas.width, manifest.canvas.height, {
      fit: manifest.sourceCanvas?.fit ?? 'cover',
      position: 'centre',
      background: '#062750',
    })
    .png()
    .toBuffer();

  await mkdir(dirname(outputPath), { recursive: true });
  await sharp(background)
    .composite([{ input: overlay }])
    .png()
    .toFile(outputPath);
  return outputPath;
}

export async function renderCropDiagnostic(
  portraitPath: string,
  outputPath: string,
): Promise<string> {
  const variants: Array<{ label: string; settings: CropSettings }> = [
    { label: 'DÉFAUT', settings: { zoom: 1 } },
    { label: 'ZOOM + X', settings: { zoom: 1.2, offsetX: 0.1 } },
    { label: 'ZOOM + Y', settings: { zoom: 1.2, offsetY: -0.1 } },
  ];
  const portraits = await Promise.all(
    variants.map((variant) => cropPortrait(portraitPath, 260, 190, variant.settings)),
  );
  const labelOverlay = Buffer.from(`
    <svg width="900" height="260" xmlns="http://www.w3.org/2000/svg">
      ${variants
        .map(
          (variant, index) =>
            `<text x="${40 + index * 290 + 130}" y="232" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="800" fill="#ffffff">${variant.label}</text>`,
        )
        .join('')}
    </svg>
  `);

  await mkdir(dirname(outputPath), { recursive: true });
  await sharp({
    create: { width: 900, height: 260, channels: 4, background: '#062750' },
  })
    .composite([
      ...portraits.map((portrait, index) => ({ input: portrait, left: 40 + index * 290, top: 20 })),
      { input: labelOverlay, left: 0, top: 0 },
    ])
    .png()
    .toFile(outputPath);
  return outputPath;
}

export async function renderPosterComparison(
  detachedPath: string,
  jpegPath: string,
  outputPath: string,
): Promise<string> {
  const [detached, jpeg] = await Promise.all([
    sharp(detachedPath).png().toBuffer(),
    sharp(jpegPath).png().toBuffer(),
  ]);
  const labels = Buffer.from(`
    <svg width="2160" height="60" xmlns="http://www.w3.org/2000/svg">
      <rect width="2160" height="60" fill="#062750" />
      <text x="540" y="32" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="28" font-weight="800" fill="#ffffff">PNG DÉTOURÉS</text>
      <text x="1620" y="32" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="28" font-weight="800" fill="#ffffff">JPG ORIGINAUX</text>
    </svg>
  `);

  await mkdir(dirname(outputPath), { recursive: true });
  await sharp({
    create: { width: 2160, height: 1410, channels: 4, background: '#062750' },
  })
    .composite([
      { input: labels, left: 0, top: 0 },
      { input: detached, left: 0, top: 60 },
      { input: jpeg, left: 1080, top: 60 },
    ])
    .png()
    .toFile(outputPath);
  return outputPath;
}
