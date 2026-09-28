import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Precachea la página de respaldo offline.
  additionalPrecacheEntries: [{ url: "/offline", revision: crypto.randomUUID() }],
  // @serwist/next no soporta Turbopack (dev de Next 16): solo activo en prod,
  // donde el build corre con webpack (ver script "build").
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        // Permite que el popup de Google mantenga la relación con el opener.
        // Sin esto Chrome muestra "Cross-Origin-Opener-Policy policy would
        // block the window.closed call" (warning benigno del SDK de Firebase
        // al pullear window.closed). No rompe el login, pero esta header lo silencia.
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
