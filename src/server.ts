/**
 * Static file server for the network dashboard.
 * Serves files from public/ with security headers and path sanitization.
 */
import { normalize, resolve } from "@std/path";

const rawPort = Deno.env.get("PORT") || "3030";
const PORT = /^\d+$/.test(rawPort) ? Number(rawPort) : 3030;
const PUBLIC_ROOT = resolve(Deno.cwd(), "public");

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
};

function getCSP(): string {
  const environment = Deno.env.get("ENVIRONMENT") || "development";
  const isProd = environment === "production";
  // Non-prod runs against local services (council-platform, network-dashboard-
  // platform, etc. on assorted localhost ports) — use `*` so dev work isn't
  // blocked. Production allows-list the dashboard-api WS hosts the SPA
  // connects to; ws/wss schemes need explicit hosts even with 'self'.
  const connectSrc = isProd
    ? "connect-src 'self' wss://dashboard-api.moonlightprotocol.io wss://dashboard-api-testnet.moonlightprotocol.io"
    : "connect-src *";
  // §4 asset-breakdown bars and a couple of inline transitions render via
  // `style="..."`. The dashboard is public + anonymous, no auth boundary
  // to defend, so 'unsafe-inline' on style-src is an acceptable trade.
  const styleSrc = "style-src 'self' 'unsafe-inline'";
  return [
    "default-src 'self'",
    "script-src 'self'",
    styleSrc,
    connectSrc,
  ].join("; ");
}

function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  headers.set("Content-Security-Policy", getCSP());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function safePath(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const resolved = resolve(PUBLIC_ROOT, "." + normalize("/" + decoded));
  if (!resolved.startsWith(PUBLIC_ROOT)) return null;
  return resolved;
}

const contentTypes: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  ico: "image/x-icon",
};

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  let pathname = url.pathname;
  if (pathname === "/") pathname = "/index.html";

  if (pathname.endsWith(".map")) {
    return addSecurityHeaders(new Response("Not Found", { status: 404 }));
  }

  const filePath = safePath(pathname);
  if (!filePath) {
    return addSecurityHeaders(new Response("Forbidden", { status: 403 }));
  }

  try {
    const file = await Deno.readFile(filePath);
    const ext = filePath.split(".").pop() || "";
    const cacheControl = ext === "html"
      ? "no-cache, no-store, must-revalidate"
      : "public, max-age=3600";
    return addSecurityHeaders(
      new Response(file, {
        headers: {
          "Content-Type": contentTypes[ext] || "application/octet-stream",
          "Cache-Control": cacheControl,
        },
      }),
    );
  } catch {
    const ext = pathname.split("/").pop()?.includes(".") ?? false;
    if (ext) {
      return addSecurityHeaders(new Response("Not Found", { status: 404 }));
    }
    try {
      const index = await Deno.readFile(resolve(PUBLIC_ROOT, "index.html"));
      return addSecurityHeaders(
        new Response(index, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        }),
      );
    } catch {
      return addSecurityHeaders(new Response("Not Found", { status: 404 }));
    }
  }
});

console.log(`Network Dashboard running on http://localhost:${PORT}`);
