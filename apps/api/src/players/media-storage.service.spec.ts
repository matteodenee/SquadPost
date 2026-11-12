import { BadRequestException } from '@nestjs/common';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { MediaStorageService } from './media-storage.service.js';

describe('MediaStorageService', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'squadpost-player-photo-'));
    process.env.MEDIA_ROOT = root;
    delete process.env.PLAYER_PHOTO_MAX_BYTES;
  });

  afterEach(async () => {
    delete process.env.MEDIA_ROOT;
    delete process.env.PLAYER_PHOTO_MAX_BYTES;
    await rm(root, { recursive: true, force: true });
  });

  it('conserve exactement le PNG transparent original', async () => {
    const original = await sharp({
      create: { width: 8, height: 6, channels: 4, background: { r: 20, g: 40, b: 60, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const storage = new MediaStorageService();

    const stored = await storage.storePlayerPhoto('club-id', 'player-id', {
      buffer: original,
      size: original.length,
      mimetype: 'application/octet-stream',
    });

    expect(stored).toMatchObject({ mimeType: 'image/png', width: 8, height: 6, hasAlpha: true });
    expect(await readFile(join(root, stored.storageKey))).toEqual(original);
  });

  it('refuse un faux fichier image même si son type MIME annonce un PNG', async () => {
    const storage = new MediaStorageService();
    const invalid = Buffer.from('not-an-image');

    await expect(
      storage.storePlayerPhoto('club-id', 'player-id', {
        buffer: invalid,
        size: invalid.length,
        mimetype: 'image/png',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applique la taille maximale configurable', async () => {
    process.env.PLAYER_PHOTO_MAX_BYTES = '4';
    const storage = new MediaStorageService();

    await expect(
      storage.storePlayerPhoto('club-id', 'player-id', {
        buffer: Buffer.alloc(5),
        size: 5,
      }),
    ).rejects.toThrow('taille maximale');
  });
});
