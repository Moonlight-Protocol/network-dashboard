import {
  COUNTRIES,
  renderWorldMap,
  type WorldMapHandle,
} from "@moonlight/ui/world-map";
import type { CouncilTopologyEntry } from "../lib/network-events.ts";

/**
 * §5 — World map. Bottom strip showing council jurisdictions.
 *
 * Visual states layered on top of the shared @moonlight/ui/world-map
 * component (which itself knows nothing about councils):
 *   - `selected`: union of all council jurisdictions in the topology.
 *   - `hovered`:  the country currently under the pointer.
 *   - `reachable`: every other country sharing a council with `hovered`.
 *   - `dimmed`:    every country not in the active focus set (faded out).
 *
 * Hover handling lives entirely on this side; the map component only
 * fires `onHover(code | null)` and exposes `setSlot()` to apply our
 * dashboard-specific CSS classes. A small popover next to the cursor
 * lists every council whose jurisdictions include the hovered country
 * (name + provider count), or "No councils" when none.
 */

const HOVERED_SLOT = "hovered";
const REACHABLE_SLOT = "reachable";
const DIMMED_SLOT = "dimmed";

export class WorldMap {
  private root: HTMLElement;
  private mapHost: HTMLDivElement;
  private status: HTMLElement;
  private popover: HTMLDivElement;
  private handle: WorldMapHandle | null = null;
  private pendingMount: Promise<void> | null = null;
  private councils: CouncilTopologyEntry[] = [];
  private allCodes: string[] = [];
  private failed = false;

  constructor() {
    this.root = document.createElement("section");
    this.root.className = "section world-map";
    this.root.setAttribute("aria-label", "Council jurisdictions");

    const header = document.createElement("header");
    header.className = "world-map-header";
    const title = document.createElement("span");
    title.className = "world-map-title";
    title.textContent = "Council jurisdictions";
    const status = document.createElement("span");
    status.className = "world-map-status";
    status.textContent = "loading…";
    this.status = status;
    header.append(title, status);

    this.mapHost = document.createElement("div");
    this.mapHost.className = "world-map-section-host";

    this.popover = document.createElement("div");
    this.popover.className = "world-map-popover";
    this.popover.hidden = true;
    this.mapHost.appendChild(this.popover);

    this.root.append(header, this.mapHost);
  }

  element(): HTMLElement {
    return this.root;
  }

  render(topology: CouncilTopologyEntry[]): void {
    this.councils = topology;
    this.allCodes = Array.from(
      topology.reduce((acc, c) => {
        for (const code of c.jurisdictions) {
          const upper = code.toUpperCase();
          if (COUNTRIES[upper]) acc.add(upper);
        }
        return acc;
      }, new Set<string>()),
    );

    if (this.failed) {
      this.status.textContent = "map unavailable";
      return;
    }
    if (this.handle) {
      this.handle.setSelected(this.allCodes);
      this.updateStatus();
      return;
    }
    if (this.pendingMount) return;

    this.pendingMount = renderWorldMap({
      selected: this.allCodes,
      svgUrl: "/world-map.svg",
      onHover: (code) => this.handleHover(code),
    })
      .then((handle) => {
        this.handle = handle;
        this.mapHost.insertBefore(handle.element, this.popover);
        handle.setSelected(this.allCodes);
        this.updateStatus();
        this.mapHost.addEventListener(
          "mousemove",
          (ev) => this.positionPopover(ev),
        );
      })
      .catch((err) => {
        this.failed = true;
        this.status.textContent = "map unavailable";
        console.warn("World map failed to load", err);
      })
      .finally(() => {
        this.pendingMount = null;
      });
  }

  private updateStatus(): void {
    this.status.textContent = this.allCodes.length === 0
      ? "no jurisdictions"
      : `${this.allCodes.length} jurisdiction${
        this.allCodes.length === 1 ? "" : "s"
      }`;
  }

  private handleHover(code: string | null): void {
    if (!this.handle) return;
    if (code === null) {
      this.handle.setSlot(HOVERED_SLOT, []);
      this.handle.setSlot(REACHABLE_SLOT, []);
      this.handle.setSlot(DIMMED_SLOT, []);
      this.popover.hidden = true;
      return;
    }

    // Councils whose jurisdictions include the hovered country.
    const hoveredCouncils = this.councils.filter((c) =>
      c.jurisdictions.some((j) => j.toUpperCase() === code)
    );

    if (hoveredCouncils.length === 0) {
      // No-council country: just dim everything else, popover says so.
      const dim = this.allCodes.filter((c) => c !== code);
      this.handle.setSlot(HOVERED_SLOT, [code]);
      this.handle.setSlot(REACHABLE_SLOT, []);
      this.handle.setSlot(DIMMED_SLOT, dim);
      this.renderPopoverEmpty(code);
      return;
    }

    // Reachable = union of jurisdictions across all councils touching `code`,
    // minus the hovered country itself.
    const reachable = new Set<string>();
    for (const c of hoveredCouncils) {
      for (const j of c.jurisdictions) {
        const upper = j.toUpperCase();
        if (upper !== code && COUNTRIES[upper]) reachable.add(upper);
      }
    }
    const focus = new Set<string>([code, ...reachable]);
    const dim = this.allCodes.filter((c) => !focus.has(c));

    this.handle.setSlot(HOVERED_SLOT, [code]);
    this.handle.setSlot(REACHABLE_SLOT, Array.from(reachable));
    this.handle.setSlot(DIMMED_SLOT, dim);
    this.renderPopoverCouncils(code, hoveredCouncils);
  }

  private renderPopoverCouncils(
    code: string,
    councils: CouncilTopologyEntry[],
  ): void {
    this.popover.textContent = "";
    const header = document.createElement("div");
    header.className = "world-map-popover-header";
    header.textContent = `${COUNTRIES[code]?.name ?? code} (${code})`;
    this.popover.appendChild(header);

    const list = document.createElement("ul");
    list.className = "world-map-popover-list";
    for (const c of councils) {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.className = "world-map-popover-name";
      name.textContent = c.name ?? c.id.slice(0, 12);
      const meta = document.createElement("span");
      meta.className = "world-map-popover-meta";
      const n = c.providers.length;
      meta.textContent = `${n} PP${n === 1 ? "" : "s"}`;
      li.append(name, meta);
      list.appendChild(li);
    }
    this.popover.appendChild(list);
    this.popover.hidden = false;
  }

  private renderPopoverEmpty(code: string): void {
    this.popover.textContent = "";
    const header = document.createElement("div");
    header.className = "world-map-popover-header";
    header.textContent = `${COUNTRIES[code]?.name ?? code} (${code})`;
    const body = document.createElement("div");
    body.className = "world-map-popover-empty";
    body.textContent = "No councils";
    this.popover.append(header, body);
    this.popover.hidden = false;
  }

  private positionPopover(ev: MouseEvent): void {
    if (this.popover.hidden) return;
    const hostRect = this.mapHost.getBoundingClientRect();
    const x = ev.clientX - hostRect.left + 14;
    const y = ev.clientY - hostRect.top + 14;
    // Keep the popover inside the host bounds; nudge left/up if needed.
    const popRect = this.popover.getBoundingClientRect();
    const maxX = hostRect.width - popRect.width - 8;
    const maxY = hostRect.height - popRect.height - 8;
    this.popover.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
    this.popover.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
  }
}
