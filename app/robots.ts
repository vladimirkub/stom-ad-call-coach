import type { MetadataRoute } from "next";

// Only the public site is for search engines; the trainer, the cabinets and the API sit behind a login.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app", "/call", "/clinic", "/admin", "/api/", "/results", "/challenge", "/setup", "/knowledge", "/operator"] },
    sitemap: "https://coach.stom-ad.com/sitemap.xml",
  };
}
