/**
 * Minimal hash-based router for SPA navigation.
 * Routes: #/map, #/councils, #/transactions, #/council/:id
 */
import { renderError } from "./dom.ts";

type RouteHandler = (params?: Record<string, string>) => HTMLElement | Promise<HTMLElement>;

const routes = new Map<string, RouteHandler>();
let cleanups: (() => void)[] = [];

export function route(path: string, handler: RouteHandler): void {
  routes.set(path, handler);
}

export function navigate(path: string, opts?: { force?: boolean }): void {
  const current = window.location.hash.replace(/^#/, "");
  if (opts?.force && current === path) {
    render();
  } else {
    window.location.hash = path;
  }
}

function matchRoute(path: string): { handler: RouteHandler; params: Record<string, string> } | null {
  // Exact match first
  const exact = routes.get(path);
  if (exact) return { handler: exact, params: {} };

  // Parameterized match: /council/:id
  for (const [pattern, handler] of routes) {
    const patternParts = pattern.split("/");
    const pathParts = path.split("/");
    if (patternParts.length !== pathParts.length) continue;

    const params: Record<string, string> = {};
    let match = true;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(":")) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }
    if (match) return { handler, params };
  }

  return null;
}

async function render(): Promise<void> {
  const hash = window.location.hash || "#/";
  const path = hash.startsWith("#") ? hash.slice(1).split("?")[0] : hash.split("?")[0];

  const matched = matchRoute(path) || (routes.has("/404") ? { handler: routes.get("/404")!, params: {} } : null);
  if (!matched) return;

  for (const fn of cleanups) {
    fn();
  }
  cleanups = [];

  const app = document.getElementById("app");
  if (!app) return;

  try {
    const element = await matched.handler(matched.params);
    app.innerHTML = "";
    app.appendChild(element);
  } catch (error) {
    app.innerHTML = "";
    const container = document.createElement("main");
    container.className = "container";
    renderError(
      container,
      "Something went wrong",
      error instanceof Error ? error.message : String(error),
    );
    app.appendChild(container);
  }

  window.scrollTo(0, 0);
}

export function startRouter(): void {
  window.addEventListener("hashchange", render);
  render();
}

export function onCleanup(fn: () => void): void {
  cleanups.push(fn);
}
