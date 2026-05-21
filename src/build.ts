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

// Pinned @moonlight/ui tag. raw.githubusercontent.com serves CSS as
// text/plain with nosniff so browsers refuse @import of these URLs; we
// fetch + concatenate at build time and write the result to public/styles.css.
// Same pattern + tag as provider-console / council-console.
const UI_LIB_TAG = "v0.3.2";
const UI_LIB_CSS_FILES = [
  "tokens/tokens.css",
  "base-styles/base-styles.css",
  "nav/nav.css",
  "world-map/world-map.css",
];

async function buildStyles(): Promise<void> {
  const parts: string[] = [];
  for (const path of UI_LIB_CSS_FILES) {
    const url =
      `https://raw.githubusercontent.com/Moonlight-Protocol/ui/${UI_LIB_TAG}/src/${path}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch ${url}: ${res.status} ${res.statusText}`,
      );
    }
    parts.push(
      `/* @moonlight/ui ${UI_LIB_TAG} — ${path} */\n${await res.text()}`,
    );
  }
  const appStyles = await Deno.readTextFile("src/app-styles.css");
  parts.push(`/* network-dashboard app-styles */\n${appStyles}`);
  await Deno.writeTextFile("public/styles.css", parts.join("\n"));
  console.log(
    `Built public/styles.css from @moonlight/ui@${UI_LIB_TAG} + src/app-styles.css`,
  );
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
