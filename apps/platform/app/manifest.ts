import type { MetadataRoute } from "next";

// The installable staff app (SPEC › Staff app). Opening it lands on "/", which
// sends each person to their shop and their role's home tab.
// TODO(owner): rename once the platform's product name is chosen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mango Works",
    short_name: "Mango Works",
    description: "Rental management for vehicle rental shops",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#c2410c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
