// Prefijo de despliegue (p. ej. "/cleverphone" en GitHub Pages). Vacío en dominio propio.
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

/** Antepone el basePath a rutas internas absolutas ("/..."). */
export function withBase(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  if (BASE_PATH && (path === BASE_PATH || path.startsWith(BASE_PATH + "/"))) return path;
  return BASE_PATH + path;
}
