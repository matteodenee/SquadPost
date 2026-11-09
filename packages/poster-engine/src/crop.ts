import sharp from 'sharp';

import type { CropSettings, FocalPoint } from './types.js';

export type CropRegion = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function calculateCoverCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  settings: CropSettings | FocalPoint = { focalPoint: { x: 0.5, y: 0.42 } },
): CropRegion {
  const legacyFocalPoint = 'x' in settings ? settings : undefined;
  const cropSettings = 'x' in settings ? undefined : settings;
  const focalPoint = legacyFocalPoint ?? cropSettings?.focalPoint ?? { x: 0.5, y: 0.42 };
  const targetRatio = targetWidth / targetHeight;
  const sourceRatio = sourceWidth / sourceHeight;
  const zoom = clamp(legacyFocalPoint?.zoom ?? cropSettings?.zoom ?? 1, 1, 4);

  let width = sourceWidth;
  let height = sourceHeight;
  if (sourceRatio > targetRatio) {
    width = Math.round(sourceHeight * targetRatio);
  } else {
    height = Math.round(sourceWidth / targetRatio);
  }

  width = Math.max(1, Math.round(width / zoom));
  height = Math.max(1, Math.round(height / zoom));

  const offsetX = clamp(cropSettings?.offsetX ?? 0, -1, 1);
  const offsetY = clamp(cropSettings?.offsetY ?? 0, -1, 1);
  const focusX = clamp(focalPoint.x + offsetX, 0, 1) * sourceWidth;
  const focusY = clamp(focalPoint.y + offsetY, 0, 1) * sourceHeight;
  const left = clamp(Math.round(focusX - width / 2), 0, sourceWidth - width);
  const top = clamp(Math.round(focusY - height / 2), 0, sourceHeight - height);

  return { left, top, width, height };
}

export async function cropPortrait(
  inputPath: string,
  width: number,
  height: number,
  settings?: CropSettings | FocalPoint,
): Promise<Buffer> {
  const oriented = await sharp(inputPath).autoOrient().toBuffer({ resolveWithObject: true });
  const cropSettings = 'x' in (settings ?? {}) ? undefined : (settings as CropSettings | undefined);

  if (cropSettings?.fit === 'contain') {
    const source = cropSettings.trimTransparent
      ? await sharp(oriented.data)
          .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 })
          .png()
          .toBuffer()
      : oriented.data;

    return sharp(source)
      .resize(width, height, {
        fit: 'contain',
        position: cropSettings.containPosition === 'bottom' ? 'south' : 'centre',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  }

  const crop = calculateCoverCrop(
    oriented.info.width,
    oriented.info.height,
    width,
    height,
    settings,
  );

  return sharp(oriented.data).extract(crop).resize(width, height, { fit: 'fill' }).png().toBuffer();
}
