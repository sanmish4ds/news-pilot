import { ImageResponse } from "next/og";

export const alt = "The News Noice: Today's Top 10 India News";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "64px",
          background: "linear-gradient(135deg, #042f2e 0%, #0a0f1a 50%, #1e1b4b 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: 24,
          }}
        >
          The News Noice: Today&apos;s Top 10 India News
        </div>
        <div style={{ fontSize: 32, color: "#99f6e4", lineHeight: 1.4 }}>
          Listen in all 22 constitutional languages
        </div>
      </div>
    ),
    { ...size }
  );
}
