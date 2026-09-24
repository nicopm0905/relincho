import "server-only";
import { PrismaClient } from "@prisma/client";

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

type PgTransaction = Awaited<
  ReturnType<Awaited<ReturnType<PrismaPg["connect"]>>["startTransaction"]>
>;

/**
 * Encola las consultas de una transaccion.
 *
 * Al resolver relaciones anidadas (`include`/`select` de relaciones) el motor
 * de Prisma 7 lanza las subconsultas a la vez con `Array.map`. Fuera de una
 * transaccion cada una coge su conexion del pool, pero dentro todas comparten
 * la misma y `pg` avisa: "client.query() when the client is already executing
 * a query", algo que pg@9 dejara de aceptar. `pg` ya las ejecutaba una tras
 * otra por dentro, asi que encolarlas aqui no cambia el rendimiento.
 */
function serializeTransaction(tx: PgTransaction): PgTransaction {
  let tail: Promise<unknown> = Promise.resolve();
  const enqueue = <R>(run: () => Promise<R>): Promise<R> => {
    const next = tail.then(run);
    tail = next.catch(() => undefined);
    return next;
  };
  const queryRaw = tx.queryRaw.bind(tx);
  const executeRaw = tx.executeRaw.bind(tx);
  // Los savepoints llaman a `this.executeRaw`, asi que tambien pasan por la cola.
  tx.queryRaw = (query) => enqueue(() => queryRaw(query));
  tx.executeRaw = (query) => enqueue(() => executeRaw(query));
  return tx;
}

class SerializedPrismaPg extends PrismaPg {
  override async connect() {
    const driver = await super.connect();
    const startTransaction = driver.startTransaction.bind(driver);
    driver.startTransaction = async (isolationLevel) =>
      serializeTransaction(await startTransaction(isolationLevel));
    return driver;
  }
}

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new SerializedPrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    // Volcar cada consulta a la terminal frena el `next dev` y la entierra en
    // ruido; se activa a mano con PRISMA_LOG_QUERIES=1 cuando haga falta.
    log:
      process.env.PRISMA_LOG_QUERIES === "1"
        ? ["query", "error", "warn"]
        : process.env.NODE_ENV === "development"
          ? ["error", "warn"]
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
    // `set_config(..., true)` = equivalente a SET LOCAL: el valor vive solo
    // dentro de esta transaccion. Parametrizado para evitar inyeccion.
    await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
    return fn(tx as unknown as PrismaClient);
  }, {
    timeout: options.timeout ?? 20_000,
    maxWait: options.maxWait ?? 10_000,
  });
}

/**
 * `Promise.all` para consultas dentro de `withTenant`.
 *
 * Una transaccion vive en una sola conexion: lanzar varias consultas a la vez
 * no las hace ir en paralelo, solo las encola dentro de `pg`, que avisa
 * ("client.query() when the client is already executing a query") y dejara de
 * aceptarlo en pg@9. Aqui se ejecutan una detras de otra, con el mismo tipo de
 * resultado que daria `Promise.all`.
 */
export async function inSequence<
  const T extends readonly (() => PromiseLike<unknown>)[],
>(tasks: T): Promise<{ -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const results: unknown[] = [];
  for (const task of tasks) results.push(await task());
  return results as { -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> };
}

export type { PrismaClient };
