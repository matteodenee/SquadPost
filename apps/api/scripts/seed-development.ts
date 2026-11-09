import { PrismaPg } from '@prisma/adapter-pg';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { PrismaClient, UserRole } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/auth/password.js';

loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));

if (process.env.NODE_ENV === 'production') {
  throw new Error('Le jeu de démonstration est interdit en production.');
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL est obligatoire.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const demoPassword = 'SquadPost-demo-2026!';

const accounts = [
  { email: 'player@squadpost.local', role: UserRole.PLAYER },
  { email: 'communication@squadpost.local', role: UserRole.COM_MANAGER },
  { email: 'admin@squadpost.local', role: UserRole.ADMIN },
];

async function seed() {
  await prisma.user.deleteMany({ where: { email: 'owner@squadpost.local' } });

  for (const account of accounts) {
    const passwordHash = await hashPassword(demoPassword);
    await prisma.user.upsert({
      where: { email: account.email },
      update: { passwordHash, role: account.role },
      create: { email: account.email, passwordHash, role: account.role },
    });
  }
}

seed()
  .then(() => {
    console.log('Comptes de développement créés pour les trois rôles.');
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
