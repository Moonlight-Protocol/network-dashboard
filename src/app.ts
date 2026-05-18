/**
 * Network-dashboard SPA entry. Single page, no router, no auth.
 *
 * Renders the 3-zone layout per the locked design sketch and pipes
 * frames from the public WebSocket to the right zone.
 */
import { NETWORK_DASHBOARD_PLATFORM_URL } from "./lib/config.ts";
import { connectNetworkPlatform } from "./lib/ws-client.ts";
import { CounterStrip } from "./views/counter-strip.ts";
import { Topology } from "./views/topology.ts";
import { ActivityFeed } from "./views/activity-feed.ts";

declare const __APP_VERSION__: string;

function renderShell(): {
  layout: HTMLElement;
  counters: CounterStrip;
  topology: Topology;
  feed: ActivityFeed;
} {
  const app = document.getElementById("app");
  if (!app) throw new Error("#app root not found");
  app.textContent = "";

  const layout = document.createElement("div");
  layout.className = "dashboard";

  const counters = new CounterStrip();
  const topology = new Topology();
  const feed = new ActivityFeed();

  layout.append(counters.element(), topology.element(), feed.element());

  const footer = document.createElement("footer");
  footer.className = "dashboard-footer";
  footer.textContent = `Moonlight Network Dashboard · v${__APP_VERSION__}`;
  layout.appendChild(footer);

  app.appendChild(layout);
  return { layout, counters, topology, feed };
}

function bootstrap() {
  const { counters, topology, feed } = renderShell();

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
    },
    onEvent: (event) => {
      // Live counter bump: events/24h is the only counter that ticks on
      // every event (the others are derived from topology + are updated by
      // the next snapshot tick at the hourly re-sync).
      // We optimistically increment here for ticker-tape feel.
      feed.append(event);
      topology.pulse(event);
    },
  });
}

bootstrap();
