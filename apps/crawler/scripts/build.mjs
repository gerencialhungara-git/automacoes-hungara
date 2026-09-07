import { build } from "esbuild";
import { rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "dist/index.mjs",
  minify: true,
  sourcemap: true,
  // Ficam de fora do bundle e são instalados no Dockerfile: o playwright resolve
  // o browser por caminho (não sobrevive a bundle) e o SDK da AWS é grande.
  external: ["playwright", "playwright-core", "@aws-sdk/*", "@hono/node-server"],
  banner: {
    // Dependências em CommonJS usam require(); em ESM ele não existe.
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  define: { "process.env.APP_VERSION": JSON.stringify(process.env.APP_VERSION ?? "dev") },
  logLevel: "info",
});
