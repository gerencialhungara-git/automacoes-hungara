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
  // O SDK da AWS já vem no runtime da Lambda; empacotá-lo só engorda o zip.
  external: ["@aws-sdk/*", "@hono/node-server"],
  banner: {
    // O exceljs (e várias deps dele) é CommonJS e usa require(); em ESM ele não existe.
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  define: { "process.env.APP_VERSION": JSON.stringify(process.env.APP_VERSION ?? "dev") },
  logLevel: "info",
});
