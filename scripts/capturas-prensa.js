/* eslint-disable @typescript-eslint/no-require-imports -- script Node autónomo para el pack de prensa */
/**
 * Pack de capturas de prensa para Relincho.
 *
 * Uso:   node scripts/capturas-prensa.js
 * Necesita: sesión válida en /tmp/cookies.txt (curl) y Chrome/Edge instalado.
 * Salida:  public/prensa/*.png  (+ pack.zip opcional)
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const BASE = "http://localhost:3100";
const OUT = path.join(__dirname, "..", "public", "prensa");
const TENANT = "yeguada-demo-andalucia";
const COOKIES_FILE = process.env.COOKIES_FILE || "/tmp/cookies.txt";

/** Páginas a capturar. label = nombre de archivo y pie de foto. */
const PAGES = [
  { slug: "inicio", label: "01-inicio-resumen" },
  { slug: "caballos", label: "02-caballos-listado" },
  { slug: "sanidad", label: "03-sanidad" },
  { slug: "reproduccion", label: "04-reproduccion" },
  { slug: "pupilaje", label: "05-pupilaje" },
  { slug: "facturacion", label: "06-facturacion" },
];

const VIEWPORT = { width: 1512, height: 945, deviceScaleFactor: 2 };

function parseCookiesFile() {
  const raw = fs.readFileSync(COOKIES_FILE, "utf8");
  return raw
    .split(/\r?\n/)
    .filter((line) => line && (line.startsWith("#HttpOnly_") || !line.startsWith("#")))
    .map((line) => line.replace(/^#HttpOnly_/, "").split("\t"))
    .filter((parts) => parts.length >= 7)
    .map((parts) => ({
      domain: parts[0],
      name: parts[5],
      value: parts[6],
    }));
}

async function settle(page, ms = 1400) {
  await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));
  try {
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 8000 });
  } catch {
    /* sigue */
  }
  await page.evaluate((m) => new Promise((r) => setTimeout(r, m)), ms);
}

/** Lanza error si la sesión murió y nos redirigió al login. */
async function assertLoggedIn(page) {
  const where = await page.evaluate(() => location.pathname);
  if (where.includes("/login")) {
    throw new Error("la sesión expiró: redirigió a /login");
  }
  return where;
}

async function hideChrome(page) {
  await page.evaluate(() => {
    // Banner de cookies
    const banner = document.querySelector("[data-cookie-banner], .cookie-banner");
    if (banner) banner.style.display = "none";
    // Badge de desarrollo de Next.js
    document
      .querySelectorAll("nextjs-portal, [data-nextjs-dev-tools-button], next-devtools-indicator")
      .forEach((el) => el.remove());
    // Barras de scroll
    document.documentElement.style.scrollbarWidth = "none";
    const style = document.createElement("style");
    style.textContent = "::-webkit-scrollbar{display:none}";
    document.head.appendChild(style);
  });
}

async function main() {
  const cookies = parseCookiesFile(COOKIES_FILE)
    .filter((c) => c.name === "authjs.session-token")
    .map((c) => ({ ...c, domain: "localhost", path: "/", httpOnly: true, secure: false }));

  if (cookies.length === 0) {
    console.error(`No hay authjs.session-token en ${COOKIES_FILE}. Refresca la sesión.`);
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2"],
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.setCookie(...cookies);

  const shots = [];

  for (const { slug, label } of PAGES) {
    const url = `${BASE}/${TENANT}/${slug}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await settle(page);
      await hideChrome(page);
      await assertLoggedIn(page);
      const file = path.join(OUT, `${label}.png`);
      await page.screenshot({ path: file });
      shots.push({ file, slug });
      console.log(`✔ ${label}.png`);
    } catch (err) {
      console.error(`✗ ${slug}: ${err.message}`);
    }
  }

  // Ficha del primer caballo
  try {
    await page.goto(`${BASE}/${TENANT}/caballos`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await settle(page);
    await hideChrome(page);
    const firstHorse = await page.evaluate(() => {
      const reserved = ["nuevo", "editar", "importar"];
      const links = [...document.querySelectorAll('a[href*="/caballos/"]')]
        .map((a) => a.getAttribute("href"))
        .filter((h) => h && /\/caballos\/[^/]+$/.test(h))
        .filter((h) => !reserved.includes(h.split("/").pop()));
      return links[0] || null;
    });
    if (firstHorse) {
      await page.goto(`${BASE}${firstHorse}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await settle(page);
      await hideChrome(page);
      await assertLoggedIn(page);
      const file = path.join(OUT, "07-ficha-caballo.png");
      await page.screenshot({ path: file });
      shots.push({ file, slug: firstHorse });
      console.log(`✔ 07-ficha-caballo.png (${firstHorse})`);
    } else {
      console.log("✗ No encontré ficha de caballo en el listado");
    }
  } catch (err) {
    console.error(`✗ ficha: ${err.message}`);
  }

  // Portada pública (sin cookie no pasa nada: es marketing)
  try {
    await page.setViewport({ ...VIEWPORT, height: 1200 });
    await page.goto(`${BASE}/landing-v2`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await settle(page);
    await hideChrome(page);
    await page.screenshot({ path: path.join(OUT, "08-web-publica.png") });
    shots.push({ file: path.join(OUT, "08-web-publica.png"), slug: "landing" });
    console.log("✔ 08-web-publica.png");
  } catch (err) {
    console.error(`✗ landing: ${err.message}`);
  }

  await browser.close();

  console.log(`\n${shots.length} capturas en public/prensa/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
