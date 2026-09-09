import "server-only";
import { PrismaClient } from "@prisma/client";

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Wraps a callback in a transaction that sets the RLS tenant context.
 * Every query inside the callback is automatically scoped to tenantId.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: PrismaClient) => Promise<T>,
  /**
   * El limite por defecto de Prisma son 5 s, insuficiente para operaciones que
   * escriben una temporada entera contra una base de datos remota.
   */
  options: { timeout?: number; maxWait?: number } = {},
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant = '${tenantId.replace(/'/g, "''")}'`,
    );
    return fn(tx as unknown as PrismaClient);
  }, {
    timeout: options.timeout ?? 20_000,
    maxWait: options.maxWait ?? 10_000,
  });
}

export type { PrismaClient };
