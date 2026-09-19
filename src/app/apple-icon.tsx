import { ImageResponse } from "next/og";

/** Icono para «añadir a inicio» en iPhone: mismo monograma, fondo de marca. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 120,
          fontWeight: 700,
        }}
      >
        R
      </div>
    ),
    { ...size },
  );
}
