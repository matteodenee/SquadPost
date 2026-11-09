import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnApplicationShutdown {
  constructor() {
    const envPath = fileURLToPath(new URL('../../../../.env', import.meta.url));
    if (!process.env.DATABASE_URL && existsSync(envPath)) loadEnvFile(envPath);

    const connectionString =
      process.env.DATABASE_URL ??
      (process.env.NODE_ENV === 'test' ? 'postgresql://test:test@localhost:5432/test' : undefined);

    if (!connectionString) {
      throw new Error("La variable d'environnement DATABASE_URL est obligatoire.");
    }

    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
