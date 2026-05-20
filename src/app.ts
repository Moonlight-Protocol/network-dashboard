/**
 * Network-dashboard SPA entry. Single page, no router, no auth.
 *
 * Renders the 5-section layout per the locked design sketch and pipes
 * frames from the public WebSocket into each section.
 *
 *   §1 Counter strip
 *   §2 Topology + Activity feed (side-by-side)
 *   §3 Council details panel (collapsed until topology click)
 *   §4 Sparklines + Asset breakdown (side-by-side)
 *   §5 World map
 */
import { renderNav } from "@moonlight/ui/nav";
import { pageLayout } from "@moonlight/ui/layout";
import { NETWORK_DASHBOARD_PLATFORM_URL } from "./lib/config.ts";
import { connectNetworkPlatform } from "./lib/ws-client.ts";
import { CounterStrip } from "./views/counter-strip.ts";
import { Topology } from "./views/topology.ts";
import { ActivityFeed } from "./views/activity-feed.ts";
import { CouncilDetails } from "./views/council-details.ts";
import { SparklineGroup } from "./views/sparklines.ts";
import { AssetBreakdown } from "./views/asset-breakdown.ts";
import { WorldMap } from "./views/world-map.ts";

declare const __APP_VERSION__: string;

function renderShell(): {
  counters: CounterStrip;
  topology: Topology;
  feed: ActivityFeed;
  details: CouncilDetails;
  sparklines: SparklineGroup;
  assets: AssetBreakdown;
  worldMap: WorldMap;
} {
  const app = document.getElementById("app");
  if (!app) throw new Error("#app root not found");
  app.textContent = "";

  const dashboard = document.createElement("div");
  dashboard.className = "dashboard";

  const counters = new CounterStrip();

  const heroRow = document.createElement("div");
  heroRow.className = "row hero";
  const topology = new Topology();
  const feed = new ActivityFeed();
  heroRow.append(topology.element(), feed.element());

  const details = new CouncilDetails();

  const trendsRow = document.createElement("div");
  trendsRow.className = "row trends";
  const sparklines = new SparklineGroup();
  const assets = new AssetBreakdown();
  trendsRow.append(sparklines.element(), assets.element());

  const worldMap = new WorldMap();

  dashboard.append(
    counters.element(),
    heroRow,
    details.element(),
    trendsRow,
    worldMap.element(),
  );

  const nav = renderNav({
    brand: "Network Dashboard",
    version: __APP_VERSION__,
  });
  app.appendChild(pageLayout(nav, dashboard));
  return { counters, topology, feed, details, sparklines, assets, worldMap };
}

function bootstrap() {
  const { counters, topology, feed, details, sparklines, assets, worldMap } =
    renderShell();

  topology.setCouncilClickHandler((councilId) => {
    details.select(councilId);
    topology.setSelectedCouncil(councilId);
  });

  if (!NETWORK_DASHBOARD_PLATFORM_URL) {
    feed.setStatus("closed");
    return;
  }

  connectNetworkPlatform(NETWORK_DASHBOARD_PLATFORM_URL, {
    onStatusChange: (status) => feed.setStatus(status),
    onSnapshot: (frame) => {
      counters.render(frame.counters);
      topology.render(frame.topology);
      feed.seed(frame.recent);
      details.setTopology(frame.topology);
      details.setRollingMetrics(frame.councilRolling);
      sparklines.render(frame.sparklines);
      assets.render(frame.assetBreakdown);
      worldMap.render(frame.topology);
    },
    onEvent: (event) => {
      feed.append(event);
      topology.pulse(event);
      counters.bumpFromLiveEvent();
    },
  });
}

bootstrap();
