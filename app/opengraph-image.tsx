import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "Essentia Wellness Club — Longevity Center & Social Wellness Club in Tenerife";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: "#103838",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        fontFamily: "sans-serif",
      }}
    >
      {/* Línea decorativa superior */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: "#c2baa5",
          display: "flex",
        }}
      />

      {/* Línea decorativa inferior */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: "#c2baa5",
          display: "flex",
        }}
      />

      {/* Contenido central */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0px",
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            fontSize: "96px",
            fontWeight: "300",
            color: "#f0ede6",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          ESSENTIA
        </div>

        {/* Separador */}
        <div
          style={{
            width: "80px",
            height: "1px",
            background: "#c2baa5",
            margin: "20px 0 24px",
            display: "flex",
          }}
        />

        {/* Subtítulo */}
        <div
          style={{
            fontSize: "24px",
            fontWeight: "300",
            color: "#c2baa5",
            letterSpacing: "0.06em",
            textAlign: "center",
            display: "flex",
          }}
        >
          Longevity Center &amp; Social Wellness Club
        </div>

        {/* Localización */}
        <div
          style={{
            fontSize: "15px",
            fontWeight: "400",
            color: "#335554",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginTop: "16px",
            display: "flex",
          }}
        >
          Tenerife · Canary Islands
        </div>
      </div>

      {/* Dominio */}
      <div
        style={{
          position: "absolute",
          bottom: "28px",
          fontSize: "13px",
          color: "#335554",
          letterSpacing: "0.08em",
          display: "flex",
        }}
      >
        essentiawellnessclub.com
      </div>
    </div>,
    size,
  );
}
