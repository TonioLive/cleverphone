// Build estático para GitHub Pages: STATIC_EXPORT=1 next build + postbuild.
// Variables: NEXT_PUBLIC_BASE_PATH (p. ej. /cleverphone) y NEXT_PUBLIC_SITE_URL.
import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  STATIC_EXPORT: "1",
  NEXT_PUBLIC_CHECKOUT_ENABLED: "0",
  NEXT_TELEMETRY_DISABLED: "1",
};
for (const [cmd, args] of [
  ["npx", ["next", "build"]],
  ["node", ["scripts/postbuild-static.mjs"]],
]) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
