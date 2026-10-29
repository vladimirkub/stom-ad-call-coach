import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its font metrics from its own package folder at runtime, so it must not be bundled.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
