"use client";

/**
 * Última red: se pinta cuando el propio layout raíz falla.
 *
 * Como reemplaza a ese layout, aquí no hay proveedor de idiomas ni estilos
 * globales garantizados, así que el texto va en castellano y el estilo en
 * línea. Es la pantalla que nadie debería ver; mejor fea y sólida que rota.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#faf9f6",
          color: "#171717",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>
            Relincho no ha podido cargar
          </h1>
          <p style={{ color: "#5f5f5c", fontSize: "0.9rem", margin: "0 0 1.5rem" }}>
            Ha fallado algo al abrir la aplicación y no se ha perdido nada de lo
            que tenías guardado. Vuelve a intentarlo en un momento.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#171717",
              color: "#fff",
              border: 0,
              borderRadius: 10,
              padding: "0.65rem 1.1rem",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Volver a intentarlo
          </button>
          {error.digest && (
            <p style={{ color: "#9a9a96", fontSize: "0.75rem", marginTop: "1.25rem" }}>
              Código del fallo: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
