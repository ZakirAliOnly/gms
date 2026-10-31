import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * A single PrismaClient for the process.
 *
 * Next.js hot-reloads modules in development, which would otherwise construct a
 * new client - and a new connection pool - on every reload until Postgres
 * refuses connections. Caching on globalThis survives reloads.
 *
 * Prisma 7 requires an explicit driver adapter for SQL providers; the client no
 * longer opens its own connection from the datasource block.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

// Route and Proxy bundles share the process pool in production too.
globalForPrisma.prisma = db;
