import { ImageResponse } from "next/og";

/**
 * Imagen de vista previa al compartir un enlace.
 *
 * El sector se mueve por WhatsApp: sin esta tarjeta, un enlace de Relincho sale
 * como texto pelado y pierde toda la credibilidad frente a uno con imagen.
 */
export const alt = "Relincho — gestión equina para yeguadas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0b0d08",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
              background: "#a3b846",
              color: "#0b0d08",
              fontSize: 46,
              fontWeight: 700,
            }}
          >
            R
          </div>
          <div style={{ display: "flex", color: "#ffffff", fontSize: 40, fontWeight: 700 }}>
            Relincho
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              color: "#ffffff",
              fontSize: 62,
              fontWeight: 700,
              lineHeight: 1.1,
              maxWidth: 900,
            }}
          >
            Rendimiento, sanidad y facturación de tu yeguada en un solo sitio
          </div>
          <div style={{ display: "flex", color: "#a3b846", fontSize: 30 }}>
            Programación del entrenamiento · alertas de tendón · pupilaje
          </div>
        </div>

        <div style={{ display: "flex", color: "#7d7d78", fontSize: 26 }}>
          relincho.vercel.app
        </div>
      </div>
    ),
    { ...size },
  );
}
