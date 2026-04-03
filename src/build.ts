/**
 * Bundles src/app.ts into public/app.js for the browser.
 * Uses esbuild via Deno with denoPlugins for import map resolution.
 */
import * as esbuild from "https://deno.land/x/esbuild@v0.20.1/mod.js";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.10";

const isProduction = Deno.args.includes("--production");
const denoJson = JSON.parse(await Deno.readTextFile("deno.json"));
const version = denoJson.version ?? "0.0.0";

async function resolveSorobanCoreVersion(): Promise<string> {
  try {
    const res = await fetch("https://api.github.com/repos/Moonlight-Protocol/soroban-core/releases/latest");
    if (!res.ok) return "unknown";
    const release = await res.json();
    return ((release.tag_name as string) ?? "unknown").replace(/^v/, "");
  } catch {
    return "unknown";
  }
}

const sorobanCoreVersion = await resolveSorobanCoreVersion();
console.log(`Resolved soroban-core version: ${sorobanCoreVersion}`);

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
    "__SOROBAN_CORE_VERSION__": JSON.stringify(sorobanCoreVersion),
    "__DEV_MODE__": JSON.stringify(!isProduction),
  },
  plugins: [...denoPlugins({ configPath: `${Deno.cwd()}/deno.json` })],
});

esbuild.stop();
console.log(`Built public/app.js${isProduction ? " (production)" : ""}`);
