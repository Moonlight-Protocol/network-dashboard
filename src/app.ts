import { route, startRouter, navigate } from "./lib/router.ts";
import { mapView } from "./views/map.ts";
import { councilsView } from "./views/councils.ts";
import { councilDetailView } from "./views/council-detail.ts";
import { transactionsView } from "./views/transactions.ts";

route("/map", mapView);
route("/councils", councilsView);
route("/council/:id", councilDetailView);
route("/transactions", transactionsView);

route("/", () => {
  navigate("/map");
  return document.createElement("div");
});

route("/404", () => {
  const el = document.createElement("div");
  el.className = "login-container";
  el.innerHTML = `<div class="login-card"><h1>404</h1><p>Page not found.</p><a href="#/map">Back to dashboard</a></div>`;
  return el;
});

startRouter();

// Dev-mode version check — __DEV_MODE__ is false in production, esbuild removes the block
import { checkVersions } from "./lib/version-check.ts";
declare const __DEV_MODE__: boolean;
if (__DEV_MODE__) {
  checkVersions().then((banner) => {
    if (banner) document.body.prepend(banner);
  });
}
