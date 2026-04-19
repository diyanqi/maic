import { PrismaClient } from '@prisma/client';
import { Client } from '@planetscale/database';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaPlanetScale } from '@prisma/adapter-planetscale';
import * as mariadb from 'mariadb';

function toBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

function shouldUsePlanetScaleAdapter(databaseUrl: string | undefined): boolean {
  const explicit = toBoolean(process.env.PRISMA_USE_PLANETSCALE_ADAPTER);
  if (explicit !== undefined) return explicit;

  if (!databaseUrl) return false;

  try {
    const parsed = new URL(databaseUrl);
    const host = parsed.hostname.toLowerCase();
    return host.endsWith('psdb.cloud') || host.includes('planetscale');
  } catch {
    return false;
  }
}

function createPlanetScaleAdapter(databaseUrl: string | undefined): PrismaPlanetScale {
  if (databaseUrl) {
    try {
      const parsed = new URL(databaseUrl);
      return new PrismaPlanetScale(
        new Client({
          host: parsed.hostname,
          username: decodeURIComponent(parsed.username || 'root'),
          password: decodeURIComponent(parsed.password || ''),
        }),
      );
    } catch {
      // Fall through to placeholder values for build-time module evaluation.
    }
  }

  return new PrismaPlanetScale(
    new Client({
      host: '127.0.0.1',
      username: 'root',
      password: '',
    }),
  );
}

function createMariaDbAdapter(databaseUrl: string | undefined): PrismaMariaDb {
  if (databaseUrl) {
    try {
      const parsed = new URL(databaseUrl);
      const database = parsed.pathname.replace(/^\//, '') || undefined;
      return new PrismaMariaDb(
        mariadb.createPool({
          host: parsed.hostname,
          port: parsed.port ? Number(parsed.port) : 3306,
          user: decodeURIComponent(parsed.username || 'root'),
          password: decodeURIComponent(parsed.password || ''),
          database,
        }),
      );
    } catch {
      // Some DATABASE_URL values include characters that URL() cannot parse.
      // Let mariadb driver parse the DSN string directly instead of falling back to localhost.
      return new PrismaMariaDb(mariadb.createPool(databaseUrl));
    }
  }

  return new PrismaMariaDb(
    mariadb.createPool({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: 'openmaic',
    }),
  );
}

function createPrismaAdapter(): PrismaPlanetScale | PrismaMariaDb {
  const databaseUrl = process.env.DATABASE_URL;

  if (shouldUsePlanetScaleAdapter(databaseUrl)) {
    return createPlanetScaleAdapter(databaseUrl);
  }

  return createMariaDbAdapter(databaseUrl);
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const adapter = createPrismaAdapter();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
