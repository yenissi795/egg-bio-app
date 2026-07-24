import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa-icon.png"],
      manifest: {
        name: "ProD EGG BIO",
        short_name: "EGG BIO",
        description: "Gestion de production et vente d'œufs bio",
        theme_color: "#166534",
        background_color: "#f0fdf4",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/pwa-icon.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-icon.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-icon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});