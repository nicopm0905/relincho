import { ImageResponse } from "next/og";

/**
 * Icono de la aplicación, generado en el servidor.
 *
 * El logo de la marca es una ilustración de 1024 px: como favicon se ve como
 * una mancha y pesa 248 KB. Un monograma sobre el fondo oscuro de la marca se
 * lee a 16 px y no añade ni un byte al repositorio.
 */
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0d08",
          color: "#a3b846",
          fontSize: 340,
          fontWeight: 700,
          letterSpacing: "-0.04em",
        }}
      >
        R
      </div>
    ),
    { ...size },
  );
}
