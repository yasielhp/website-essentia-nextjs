"use client";

import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// global-error envuelve todo el árbol, incluyendo el root layout,
// por lo que debe incluir sus propios <html> y <body>.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#103838",
          color: "#faf8f5",
          fontFamily: "Georgia, serif",
          textAlign: "center",
          padding: "20px",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
            maxWidth: "480px",
          }}
        >
          {/* Label */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ height: "1px", width: "32px", background: "#c2baa5" }} />
            <p
              style={{
                fontSize: "11px",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "#c2baa5",
                margin: 0,
              }}
            >
              Critical error
            </p>
            <span style={{ height: "1px", width: "32px", background: "#c2baa5" }} />
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: "clamp(2rem, 8vw, 3.5rem)",
              fontWeight: 400,
              lineHeight: 1.1,
              margin: 0,
              color: "#faf8f5",
            }}
          >
            Something went
            <br />
            wrong.
          </h1>

          {/* Body */}
          <p style={{ color: "#c2baa5", fontSize: "14px", margin: 0 }}>
            A critical error has occurred. Please reload the page or try again.
          </p>

          {/* CTA */}
          <button
            onClick={reset}
            style={{
              marginTop: "8px",
              background: "#faf8f5",
              color: "#103838",
              border: "none",
              borderRadius: "9999px",
              padding: "14px 32px",
              fontSize: "14px",
              fontFamily: "inherit",
              fontWeight: 500,
              cursor: "pointer",
              letterSpacing: "0.01em",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
