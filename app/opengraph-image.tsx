import { ImageResponse } from "next/og";

// Link preview for messengers and social networks: the product name over a voice waveform, in the site's palette.
// Latin text only, so the default font of the image renderer is enough.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Stom AD Call Coach";

const BARS = [18, 34, 60, 42, 88, 120, 74, 140, 96, 58, 112, 150, 84, 46, 102, 66, 30, 54, 92, 38, 20];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#101318", padding: 80 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {BARS.map((h, i) => (
            <div key={i} style={{ width: 14, height: h, borderRadius: 7, background: "#6fdcb8" }} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 84, fontWeight: 700, color: "#ffffff", letterSpacing: -2 }}>Stom AD Call Coach</div>
          <div style={{ fontSize: 34, color: "#a9b1bd" }}>AI call trainer for dental clinic administrators</div>
        </div>
      </div>
    ),
    size,
  );
}
