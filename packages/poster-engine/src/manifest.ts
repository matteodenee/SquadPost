import { readFile } from 'node:fs/promises';

import type { LayoutManifest, Rect } from './types.js';

function assertRect(value: unknown, label: string): asserts value is Rect {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${label} must be an object.`);
  }

  const rect = value as Record<string, unknown>;
  for (const key of ['x', 'y', 'width', 'height']) {
    if (typeof rect[key] !== 'number' || rect[key] < 0) {
      throw new Error(`${label}.${key} must be a non-negative number.`);
    }
  }

  if (rect.width === 0 || rect.height === 0) {
    throw new Error(`${label} must have a positive width and height.`);
  }
}

function assertInsideCanvas(rect: Rect, canvas: { width: number; height: number }, label: string) {
  if (rect.x + rect.width > canvas.width || rect.y + rect.height > canvas.height) {
    throw new Error(`${label} must stay inside the manifest canvas.`);
  }
}

export function validateManifest(value: unknown): LayoutManifest {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The layout manifest must be an object.');
  }

  const manifest = value as Partial<LayoutManifest>;
  if (manifest.schemaVersion !== 1) {
    throw new Error('Unsupported layout manifest schema version.');
  }
  if (!manifest.id || !manifest.kind || !manifest.canvas) {
    throw new Error('The layout manifest is missing required metadata.');
  }
  if (!Number.isInteger(manifest.canvas.width) || !Number.isInteger(manifest.canvas.height)) {
    throw new Error('The canvas dimensions must be integers.');
  }
  if (!Array.isArray(manifest.playerSlots) || !Array.isArray(manifest.fieldSlots)) {
    throw new Error('The layout manifest must declare playerSlots and fieldSlots arrays.');
  }

  manifest.playerSlots.forEach((slot, index) => {
    assertRect(slot.photo, `playerSlots[${index}].photo`);
    assertInsideCanvas(slot.photo, manifest.canvas!, `playerSlots[${index}].photo`);
    assertRect(slot.name, `playerSlots[${index}].name`);
    assertInsideCanvas(slot.name, manifest.canvas!, `playerSlots[${index}].name`);
    if (slot.frame) {
      assertRect(slot.frame, `playerSlots[${index}].frame`);
      assertInsideCanvas(slot.frame, manifest.canvas!, `playerSlots[${index}].frame`);
    }
    if (slot.number) {
      assertRect(slot.number.box, `playerSlots[${index}].number.box`);
      assertInsideCanvas(slot.number.box, manifest.canvas!, `playerSlots[${index}].number.box`);
    }
  });
  manifest.fieldSlots.forEach((slot, index) => {
    assertRect(slot.box, `fieldSlots[${index}].box`);
  });
  manifest.graphicRegions?.forEach((region, index) => {
    assertRect(region.box, `graphicRegions[${index}].box`);
  });
  manifest.protectedRegions?.forEach((region, index) => {
    assertRect(region.box, `protectedRegions[${index}].box`);
    assertInsideCanvas(region.box, manifest.canvas!, `protectedRegions[${index}].box`);
  });
  manifest.imageSlots?.forEach((slot, index) => {
    assertRect(slot.box, `imageSlots[${index}].box`);
  });

  return manifest as LayoutManifest;
}

export async function loadManifest(path: string): Promise<LayoutManifest> {
  const source = await readFile(path, 'utf8');
  return validateManifest(JSON.parse(source) as unknown);
}
