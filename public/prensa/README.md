# Pack de prensa — Relincho

8 capturas retina (3024×1890 px, resolución de impresión y web) de la yeguada demo
(`yeguada-demo-andalucia`), tomadas directamente de la aplicación.

## Capturas y uso sugerido

| # | Archivo | Qué muestra | Úsalo para |
|---|---|---|---|
| 1 | `01-inicio-resumen.png` | Panel de inicio de la yeguada | Imagen principal de la nota de prensa |
| 2 | `02-caballos-listado.png` | Listado de la cuadra | Redes sociales (carrusel) |
| 3 | `03-sanidad.png` | Vacunas, tratamientos y recordatorios | Citar el dolor "se me olvida la vacuna" |
| 4 | `04-reproduccion.png` | Celos, cubriciones, gestaciones | Público yegüero (PRE) |
| 5 | `05-pupilaje.png` | Boxes, estancias y tarifas | Público picadero/deporte |
| 6 | `06-facturacion.png` | Facturación con Veri\*Factu | Diferencial legal/normativo |
| 7 | `07-ficha-caballo.png` | Ficha completa de un caballo | Cierre de la nota ("profundidad") |
| 8 | `08-web-publica.png` | La web pública relincho.vercel.app | Contexto de marca |

## Cómo adjuntarlas

- Al correo del portal: **máximo 2–3** (la 1, la 3 y la 7 cuentan la historia mejor).
- Al resto de prensa: adjunta el ZIP completo `pack-prensa-relincho.zip`.
- Para Instagram/TikTok del portal: recorta cuadrados 1:1 o 4:5 de las capturas.

## Antes de enviar (2 minutos)

1. Abre `contact-sheet.html` en el navegador y revisa que las pantallas se ven
   limpias (no aparecen datos personales reales — es la yeguada demo).
2. Revisa los pies de foto: están escritos a partir del nombre de cada sección,
   ajústalos si alguna pantalla muestra otra cosa.
3. Si alguna captura te parece poco vistosa, vuelve a generarlas con datos más
   bonitos: `npm run db:seed` y luego `node scripts/capturas-prensa.js`
   (necesita sesión activa; mira el script para detalles).

## Regenerar

```bash
# 1. Arranca el dev server en el puerto 3100
npm run dev -- -p 3100

# 2. Haz login (el enlace mágico sale por consola en dev) y guarda la cookie:
#    curl -c cookies.txt ... (ver scripts/capturas-prensa.js)

# 3. Captura
COOKIES_FILE=$(cygpath -w /tmp/cookies.txt) node scripts/capturas-prensa.js

# 4. Empaqueta
cd public/prensa && powershell -Command "Compress-Archive -Force 01-*.png,02-*.png,03-*.png,04-*.png,05-*.png,06-*.png,07-*.png,08-*.png -DestinationPath pack-prensa-relincho.zip"
```
