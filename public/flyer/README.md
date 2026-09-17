# Flyer Relincho — evento ecuestre Jerez

## Qué hay aquí

- **`flyer-relincho-a5.pdf`** → el archivo final listo para llevar a imprimir (A5 vertical, 1 cara, con QR).
- **`preview.html`** → vista previa del diseño (ábrela en el navegador para verlo sin imprimir).
- **`qr.png`** → el QR a `relincho.vercel.app` por si lo quieres reutilizar (camiseta, cartel, azulejo...).
- **`generar-flyer.js`** → el script que genera el PDF.
- **`prompt-claude-design.md`** → prompt de respaldo para regenerar el diseño con Claudio Design.

## Regenerar el PDF tras cambiar textos

```bash
node public/flyer/generar-flyer.js
```

Antes, edita las constantes del inicio de `generar-flyer.js`:

- `EVENTO` → ya configurado: `"VIERNES 18 · PARADA HÍPICA · 19:00"`. Si queréis otra pastilla, cambiadla aquí (máx. ~44 caracteres para que quepa).
- `URL_WEB` → por si la web cambia de dominio.
- `EMAIL` → correo de contacto.

## Instrucciones para la imprenta

- Tamaño: **A5 (148 × 210 mm)**
- Color: **a doble cara o solo cara** (el diseño actual es de 1 cara)
- Papel recomendado: **estucado brillo o mate 135–170 g**
- Sin marcas de corte ni sangrado necesario (fondo a sangre ya incluido)
- Cantidad sugerida: **100–200** para el evento

## El evento: Parada Hípica de Jerez 2026

- **Cuándo:** viernes 18 de septiembre de 2026, **19:00** (Día Europeo del Caballo)
- **Salida:** Parque González Hontoria · **Llegada:** Real Escuela Andaluza del Arte Ecuestre
- **Comitiva:** +100 caballos y 20 enganches · ~6.400 m de recorrido
- **Itinerario (prensa local):** Av. Álvaro Domecq → plaza del Caballo → calle Sevilla → San Juan Grande → Mamelón → Marqués de Casa-Domecq → **calle Larga** → Lancería → **plaza del Arenal** → Corredera → plaza de las Angustias → Santísima Trinidad → Medina → calle Honda → Rotonda de los Casinos → calle Larga → **Alameda Cristina** → calle Sevilla → (bifurcación) calle Cádiz / Duque de Abrantes / parking Real Escuela → Av. Cruz Roja → plaza del Caballo → Hontoria → Glorieta Yeguada Militar → Segundo Depósito de Sementales

### Dónde repartir (nuestro plan sugerido)

1. **19:00–19:45 · Salida en Hontoria / Av. Álvaro Domecq**: público esperando, buen momento.
2. **20:00–21:00 · Centro: calle Larga, plaza del Arenal y Alameda Cristina**: máxima densidad de espectadores mientras la comitiva pasa.
3. **Al final · plaza del Caballo / entorno Real Escuela**: gente esperando el final y paseando.

Los dos primeros puntos cubren a la mayoría del público con 100–200 flyers.
