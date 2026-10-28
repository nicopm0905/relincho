// Lo ejecuta `npm install` (script "prepare"): activa los hooks versionados en
// .githooks. En Node y no en shell porque en cmd.exe no existe `|| true`.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

// En CI y en Vercel no hay hooks que activar (y puede no haber .git).
if (process.env.CI || process.env.VERCEL || !existsSync(".git")) process.exit(0);
try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "ignore" });
} catch {
  console.warn("[hooks] No se pudo activar .githooks. Hazlo a mano: git config core.hooksPath .githooks");
}
