/**
 * Bundles src/app.ts into public/app.js and emits the auxiliary build
 * artifacts the static server hosts:
 *
 *   - public/app.js        — bundled SPA
 *   - public/styles.css    — the single app stylesheet (no upstream concat)
 *   - public/health.json   — used by /health probes in deploy-verify
 */
// deno-lint-ignore no-import-prefix -- build script intentionally pins the URL
import * as esbuild from "https://deno.land/x/esbuild@v0.20.1/mod.js";
// deno-lint-ignore no-import-prefix -- build script intentionally pins the version
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.10";

async function writeHealthJson(version: string): Promise<void> {
  const health = { status: "ok", service: "network-dashboard", version };
  await Deno.writeTextFile("public/health.json", JSON.stringify(health) + "\n");
  console.log(`Built public/health.json (network-dashboard ${version})`);
}

async function buildStyles(): Promise<void> {
  const appStyles = await Deno.readTextFile("src/app-styles.css");
  await Deno.writeTextFile(
    "public/styles.css",
    `/* network-dashboard app-styles */\n${appStyles}`,
  );
  console.log("Built public/styles.css from src/app-styles.css");
}

const isProduction = Deno.args.includes("--production");
const denoJson = JSON.parse(await Deno.readTextFile("deno.json"));
const version = denoJson.version ?? "0.0.0";

await writeHealthJson(version);
await buildStyles();

await esbuild.build({
  entryPoints: ["src/app.ts"],
  bundle: true,
  outfile: "public/app.js",
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: isProduction,
  sourcemap: !isProduction,
  define: {
    "__APP_VERSION__": JSON.stringify(version),
  },
  plugins: [...denoPlugins({ configPath: `${Deno.cwd()}/deno.json` })],
});

esbuild.stop();
console.log(`Built public/app.js${isProduction ? " (production)" : ""}`);
