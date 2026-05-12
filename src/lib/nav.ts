import { renderNav } from "@moonlight/ui/nav";

declare const __APP_VERSION__: string;

/**
 * Network-dashboard nav with the fixed brand + top-level links shared
 * across every view. Each view calls this helper instead of the lib's
 * renderNav directly to avoid duplicating the brand/links arrays.
 */
export function getNav(): HTMLElement {
  return renderNav({
    brand: "Moonlight Network",
    version: __APP_VERSION__,
    links: [
      { href: "#/map", label: "Map" },
      { href: "#/councils", label: "Councils" },
      { href: "#/transactions", label: "Transactions" },
    ],
  });
}
