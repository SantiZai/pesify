import type { NextConfig } from "next";

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

export default nextConfig;
