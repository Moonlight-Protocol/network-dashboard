/**
 * Bundles src/app.ts into public/app.js for the browser.
 * Uses esbuild via Deno with denoPlugins for import map resolution.
 */
// deno-lint-ignore no-import-prefix -- build script intentionally pins the URL
import * as esbuild from "https://deno.land/x/esbuild@v0.20.1/mod.js";
// deno-lint-ignore no-import-prefix -- build script intentionally pins the version
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.10";

// Pinned @moonlight/ui tag. raw.githubusercontent.com serves CSS as
// text/plain with nosniff so browsers refuse @import of these URLs; we
// fetch + concatenate at build time and write the result to public/styles.css.
// Do not change without bumping the consumer-side deps explicitly.
const UI_LIB_TAG = "v0.3.1";
const UI_LIB_CSS_FILES = [
  "tokens/tokens.css",
  "base-styles/base-styles.css",
];

async function writeHealthJson(version: string): Promise<void> {
  const health = { status: "ok", service: "network-dashboard", version };
  await Deno.writeTextFile("public/health.json", JSON.stringify(health) + "\n");
  console.log(`Built public/health.json (network-dashboard ${version})`);
}

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
    const body = await res.text();
    parts.push(`/* @moonlight/ui ${UI_LIB_TAG} — ${path} */\n${body}`);
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
    "__DEV_MODE__": JSON.stringify(!isProduction),
  },
  plugins: [...denoPlugins({ configPath: `${Deno.cwd()}/deno.json` })],
});

esbuild.stop();
console.log(`Built public/app.js${isProduction ? " (production)" : ""}`);
