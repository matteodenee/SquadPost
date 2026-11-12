import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp, { type Metadata } from 'sharp';

export interface UploadedPhoto {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
  size: number;
}

export interface StoredPhoto {
  storageKey: string;
  mimeType: 'image/png' | 'image/jpeg';
  sizeBytes: number;
  width: number;
  height: number;
  hasAlpha: boolean;
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;

@Injectable()
export class MediaStorageService {
  private readonly root: string;
  readonly maxPhotoBytes: number;

  constructor() {
    const envPath = fileURLToPath(new URL('../../../../.env', import.meta.url));
    if (!process.env.MEDIA_ROOT && existsSync(envPath)) loadEnvFile(envPath);

    this.root = resolve(process.env.MEDIA_ROOT ?? resolve(process.cwd(), 'media-data'));
    const configuredMax = Number(process.env.PLAYER_PHOTO_MAX_BYTES ?? DEFAULT_MAX_BYTES);
    this.maxPhotoBytes =
      Number.isSafeInteger(configuredMax) && configuredMax > 0 ? configuredMax : DEFAULT_MAX_BYTES;
  }

  async storePlayerPhoto(
    clubId: string,
    playerId: string,
    file: UploadedPhoto,
  ): Promise<StoredPhoto> {
    if (!file?.buffer?.length)
      throw new BadRequestException('Une photo JPG ou PNG est obligatoire.');
    if (file.size > this.maxPhotoBytes || file.buffer.length > this.maxPhotoBytes) {
      throw new BadRequestException(
        `La photo dépasse la taille maximale autorisée de ${this.maxPhotoBytes} octets.`,
      );
    }

    let metadata: Metadata;
    try {
      const image = sharp(file.buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS });
      metadata = await image.metadata();
      await image.stats();
    } catch {
      throw new BadRequestException('Le fichier fourni ne contient pas une image valide.');
    }

    if (metadata.format !== 'png' && metadata.format !== 'jpeg') {
      throw new BadRequestException('Seules les photos PNG et JPG sont acceptées.');
    }
    if (!metadata.width || !metadata.height) {
      throw new BadRequestException("Les dimensions de l'image sont invalides.");
    }

    const extension = metadata.format === 'png' ? 'png' : 'jpg';
    const mimeType = metadata.format === 'png' ? 'image/png' : 'image/jpeg';
    const storageKey = `clubs/${clubId}/players/${playerId}/${randomUUID()}.${extension}`;
    const destination = this.resolveStorageKey(storageKey);
    const temporary = `${destination}.tmp-${randomUUID()}`;

    await mkdir(dirname(destination), { recursive: true });
    try {
      await writeFile(temporary, file.buffer, { flag: 'wx' });
      await rename(temporary, destination);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }

    return {
      storageKey,
      mimeType,
      sizeBytes: file.buffer.length,
      width: metadata.width,
      height: metadata.height,
      hasAlpha: Boolean(metadata.hasAlpha),
    };
  }

  read(storageKey: string) {
    return readFile(this.resolveStorageKey(storageKey));
  }

  async remove(storageKey: string) {
    await unlink(this.resolveStorageKey(storageKey)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }

  private resolveStorageKey(storageKey: string) {
    const absolutePath = resolve(this.root, storageKey);
    if (!absolutePath.startsWith(`${this.root}${sep}`)) {
      throw new BadRequestException('Référence média invalide.');
    }
    return absolutePath;
  }
}
