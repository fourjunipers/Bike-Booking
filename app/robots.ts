import type { MetadataRoute } from "next";

/** Search engines may crawl the customer site, not the dashboards. */
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/vendor", "/admin", "/account", "/login", "/auth", "/api"],
    },
    // TODO(phase-7): sitemap with model, shop and area pages.
    host: site,
  };
}
