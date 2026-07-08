/**
 * Network-dashboard SPA entry. Single page, no router, no auth.
 *
 * Layout (top to bottom):
 *   1. Counter strip
 *   2. World map + Country details (2/3 + 1/3)
 *   3. Detail trio — Events + Council details + Provider details (1/3 each)
 *   4. Sparklines + Asset breakdown
 *
 * Drilldown chain: map country click → CountryDetails lists councils →
 * council click → CouncilDetails populates → PP click → ProviderDetails
 * populates.
 */
import { renderNav } from "@moonlight/ui/nav";
import { pageLayout } from "@moonlight/ui/layout";
import { NETWORK_DASHBOARD_PLATFORM_URL } from "./lib/config.ts";
import { initAnalytics } from "./lib/analytics.ts";
import { connectNetworkPlatform } from "./lib/ws-client.ts";
import { renderError } from "./lib/dom.ts";
import { errorCopy, TRANSPORT_ERROR_CODES } from "./lib/error-copy.ts";
import { CounterStrip } from "./views/counter-strip.ts";
import { ActivityFeed } from "./views/activity-feed.ts";
import { CouncilDetails } from "./views/council-details.ts";
import { SparklineGroup } from "./views/sparklines.ts";
import { AssetBreakdown } from "./views/asset-breakdown.ts";
import { WorldMap } from "./views/world-map.ts";
import { CountryDetails } from "./views/country-details.ts";
import { ProviderDetails } from "./views/provider-details.ts";

declare const __APP_VERSION__: string;

function renderShell(): {
  counters: CounterStrip;
  feed: ActivityFeed;
  details: CouncilDetails;
  sparklines: SparklineGroup;
  assets: AssetBreakdown;
  worldMap: WorldMap;
  countryDetails: CountryDetails;
  providerDetails: ProviderDetails;
  banner: HTMLElement;
} {
  const app = document.getElementById("app");
  if (!app) throw new Error("#app root not found");
  app.textContent = "";

  const dashboard = document.createElement("div");
  dashboard.className = "dashboard";

  // Connection / degraded-data banner. Hidden until an error surfaces —
  // either a WS transport failure or a structured error frame the backend
  // pushes over the socket.
  const banner = document.createElement("div");
  banner.className = "connection-banner";
  banner.hidden = true;
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");

  const counters = new CounterStrip();

  // 3×3 grid:
  //   row 1: map  map  country-details
  //   row 2: map  map  council-details
  //   row 3: feed feed provider-details
  // Positions are CSS-driven via grid-template-areas; DOM order is just
  // for accessibility / focus traversal.
  const grid = document.createElement("div");
  grid.className = "row detail-grid";
  const worldMap = new WorldMap();
  const countryDetails = new CountryDetails();
  const details = new CouncilDetails();
  const providerDetails = new ProviderDetails();
  const feed = new ActivityFeed();
  grid.append(
    worldMap.element(),
    countryDetails.element(),
    details.element(),
    feed.element(),
    providerDetails.element(),
  );

  const trendsRow = document.createElement("div");
  trendsRow.className = "row trends";
  const sparklines = new SparklineGroup();
  const assets = new AssetBreakdown();
  trendsRow.append(sparklines.element(), assets.element());

  dashboard.append(
    banner,
    counters.element(),
    grid,
    trendsRow,
  );

  const nav = renderNav({
    brand: "Network Dashboard",
    version: __APP_VERSION__,
  });
  app.appendChild(pageLayout(nav, dashboard));
  return {
    counters,
    feed,
    details,
    sparklines,
    assets,
    worldMap,
    countryDetails,
    providerDetails,
    banner,
  };
}

initAnalytics();

function bootstrap() {
  const {
    counters,
    feed,
    details,
    sparklines,
    assets,
    worldMap,
    countryDetails,
    providerDetails,
    banner,
  } = renderShell();

  const showBanner = (title: string, copy: string) => {
    banner.hidden = false;
    renderError(banner, title, copy);
  };
  const clearBanner = () => {
    banner.hidden = true;
    banner.textContent = "";
  };

  // Drilldown wiring: country → council → PP.
  worldMap.setOnCountryClick((countryCode) => {
    countryDetails.select(countryCode);
    worldMap.setSelectedCountry(countryCode);
  });
  countryDetails.setOnCouncilClick((councilId) => {
    details.select(councilId);
    providerDetails.clear();
  });
  details.setOnPpClick((pubKey) => {
    providerDetails.select(pubKey);
  });

  if (!NETWORK_DASHBOARD_PLATFORM_URL) {
    feed.setStatus("closed");
    showBanner(
      "Live feed",
      errorCopy({ code: TRANSPORT_ERROR_CODES.NOT_CONFIGURED }),
    );
    return;
  }

  connectNetworkPlatform(NETWORK_DASHBOARD_PLATFORM_URL, {
    onStatusChange: (status) => {
      feed.setStatus(status);
      // Surface a real, mapped message on a dropped/failed connection; clear
      // it once the socket is live again.
      if (status === "open") {
        clearBanner();
      } else if (status === "closed") {
        showBanner(
          "Live feed",
          errorCopy({ code: TRANSPORT_ERROR_CODES.DISCONNECTED }),
        );
      }
    },
    // A structured error frame from the backend: the socket is still live but
    // some data may be degraded (e.g. council-platform topology refresh
    // failed). Map its code to operator copy.
    onError: (error) => showBanner("Network data", errorCopy(error)),
    onSnapshot: (frame) => {
      counters.render(frame.counters);
      feed.seed(frame.recent);
      details.setTopology(frame.topology);
      details.setRollingMetrics(frame.councilRolling);
      sparklines.render(frame.sparklines);
      assets.render(frame.assetBreakdown);
      worldMap.render(frame.topology);
      countryDetails.setTopology(frame.topology);
      providerDetails.setTopology(frame.topology);
      providerDetails.setRecent(frame.recent);
    },
    onEvent: (event, liveCounters) => {
      feed.append(event);
      counters.render(liveCounters);
    },
  });
}

bootstrap();
