import { ImageResponse } from "next/og";

// Home-screen icon for iPhone and iPad: the same mint waveform as app/icon.svg, full-bleed because iOS rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const BARS: [number, number][] = [
  [13, 10],
  [22.5, 26],
  [32, 38],
  [41.5, 20],
  [51, 8],
];

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(180deg, #8af0cb, #4fd1a6)" }}>
        <svg width="180" height="180" viewBox="0 0 64 64">
          <g transform="translate(32 32) scale(0.82) translate(-32 -32)" stroke="#0b1210" strokeWidth="6.5" strokeLinecap="round">
            {BARS.map(([x, h]) => (
              <path key={x} d={`M${x} ${32 - h / 2}v${h}`} />
            ))}
          </g>
        </svg>
      </div>
    ),
    size,
  );
}
