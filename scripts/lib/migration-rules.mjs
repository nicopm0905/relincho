/**
 * Reglas estáticas sobre el SQL de las migraciones (tests/migrations.test.ts).
 * Son las dos trampas que ya nos han mordido o que el roadmap anticipa.
 */

/** Migración base: el esquema de producción del 28 oct 2026 (roadmap §1.7). */
export const BASELINE = "20261028120000_base";

/** Nombre de tabla sin esquema ni comillas: `public."Lesson"` → `Lesson`. */
const tableName = (raw) => raw.replace(/^(?:"?public"?\.)/i, "").replace(/"/g, "");

/**
 * Tablas que la migración crea y no protege con RLS. La app conecta con
 * BYPASSRLS, pero sin RLS la Data API de Supabase las expondría a `anon`.
 */
export function tablesWithoutRls(sql) {
  const created = [...sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?((?:"?public"?\.)?"?[\w]+"?)/gi)].map(
    (m) => tableName(m[1]),
  );
  const protectedTables = new Set(
    [...sql.matchAll(/ALTER TABLE\s+(?:ONLY\s+)?((?:"?public"?\.)?"?[\w]+"?)\s+ENABLE ROW LEVEL SECURITY/gi)].map(
      (m) => tableName(m[1]),
    ),
  );
  return created.filter((t) => !protectedTables.has(t));
}

/**
 * Valores de enum que se añaden (`ALTER TYPE … ADD VALUE`) y se usan en la
 * misma migración. Postgres no deja usar un valor nuevo en la transacción que
 * lo crea: hay que partirlo en dos migraciones. Devuelve `Tipo.VALOR`.
 */
export function enumValuesUsedInSameMigration(sql) {
  const added = [
    ...sql.matchAll(/ALTER TYPE\s+(?:"?public"?\.)?"?(\w+)"?\s+ADD VALUE\s+(?:IF NOT EXISTS\s+)?'(\w+)'/gi),
  ];
  const withoutAdds = sql.replace(/ALTER TYPE[^;]*ADD VALUE[^;]*;/gi, "");
  return added
    .filter(([, , value]) => withoutAdds.includes(`'${value}'`))
    .map(([, type, value]) => `${type}.${value}`);
}
