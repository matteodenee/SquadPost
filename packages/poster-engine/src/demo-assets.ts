import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import sharp from 'sharp';

type Crop = { left: number; top: number; width: number; height: number };

async function extractLightLogo(
  sourcePath: string,
  outputPath: string,
  crop: Crop,
): Promise<string> {
  const { data, info } = await sharp(sourcePath)
    .extract(crop)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const offset = pixel * info.channels;
    const maximum = Math.max(data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0);
    data[offset + 3] = Math.max(0, Math.min(255, (maximum - 65) * 4));
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await sharp(data, { raw: info }).png().toFile(outputPath);
  return outputPath;
}

export async function prepareDemoLogos(
  presentationBackgroundPath: string,
  outputDirectory: string,
): Promise<Record<'homeLogo' | 'awayLogo', string>> {
  const homeLogo = resolve(outputDirectory, 'barbarians-logo.png');
  const awayLogo = resolve(outputDirectory, 'moma-logo.png');

  await Promise.all([
    extractLightLogo(presentationBackgroundPath, homeLogo, {
      left: 188,
      top: 703,
      width: 283,
      height: 288,
    }),
    extractLightLogo(presentationBackgroundPath, awayLogo, {
      left: 700,
      top: 714,
      width: 215,
      height: 154,
    }),
  ]);

  return { homeLogo, awayLogo };
}
