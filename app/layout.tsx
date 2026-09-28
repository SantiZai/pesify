import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/firebase/auth-context";
import { AuthGuard } from "@/components/auth-guard";
import { ThemeProvider } from "@/components/theme-provider";
import { FxProvider } from "@/lib/fx";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pesify",
  description: "App instalable para gastos familiares offline",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pesify",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#15803d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        {/* Toda la app sabe si hay usuario o no */}
        <ThemeProvider>
          <AuthProvider>
            <FxProvider>
              <AuthGuard>
                {children}
              </AuthGuard>
            </FxProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}