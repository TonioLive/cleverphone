import type { Metadata, Viewport } from "next";
import "./globals.css";
import { withBase } from "@/lib/base-path";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:5173";
const description =
  "Explora móviles nuevos y de segunda mano. Compara marcas, capacidades y precios con IVA incluido en CleverPhone. Una forma más clara de elegir tu próximo móvil.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl.endsWith("/") ? siteUrl : siteUrl + "/"),
  title: "CleverPhone · Tu próximo móvil, bien elegido.",
  description,
  icons: { icon: withBase("/favicon.svg") },
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "CleverPhone",
    title: "CleverPhone · Tu próximo móvil, bien elegido.",
    description,
    images: [{ url: "/images/hero.webp", width: 1600, height: 900 }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#1467fa" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
