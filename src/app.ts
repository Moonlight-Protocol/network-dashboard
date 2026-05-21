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
import { connectNetworkPlatform } from "./lib/ws-client.ts";
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
} {
  const app = document.getElementById("app");
  if (!app) throw new Error("#app root not found");
  app.textContent = "";

  const dashboard = document.createElement("div");
  dashboard.className = "dashboard";

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
  };
}

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
  } = renderShell();

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
    return;
  }

  connectNetworkPlatform(NETWORK_DASHBOARD_PLATFORM_URL, {
    onStatusChange: (status) => feed.setStatus(status),
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
