import type { NextConfig } from "next";

// STATIC_EXPORT=1 genera un sitio estático (GitHub Pages) en ./out.
// Las rutas /api (Stripe, D1) solo existen en el despliegue con servidor (Cloudflare).
const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  trailingSlash: true,
  ...(staticExport
    ? {
        output: "export",
        basePath: basePath || undefined,
        images: { unoptimized: true },
        // Solo .tsx: excluye los route handlers (.ts) de app/api del export estático.
        pageExtensions: ["tsx"],
      }
    : {}),
};

export default nextConfig;
