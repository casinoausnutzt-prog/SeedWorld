// @doc-anchor ENGINE-CORE
// VoxelUIController – orchestriert CanvasVoxelRenderer + KernelController fuer das
// Factorio-Light-MVP. Behaelt die gleiche Bootstrap/Destroy-Schnittstelle wie UIController.

import { CanvasVoxelRenderer } from "./CanvasVoxelRenderer.js";

const TICK_RATE_MS = 100; // 10 Ticks/Sek

export class VoxelUIController {
  constructor({ kernel, elements = {} } = {}) {
    if (!kernel || typeof kernel.execute !== "function") {
      throw new Error("[VOXEL_UI] kernel mit execute() erforderlich.");
    }

    this.kernel   = kernel;
    this.elements = elements;
    this.gameState = null;
    this.currentTick = 0;
    this.tickTimer = null;
    this.voxelRenderer = null;
    this._selectedStructure = "mine";
    this._buildOptions = [];
    this._destroyed = false;
    this._hudUpdateTimer = null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async bootstrap() {
    // 1. Initialzustand vom Kernel holen
    const initResult = await this.kernel.execute({
      domain: "game",
      action: { type: "generate_world", payload: { seed: this.kernel.seed } }
    });
    this.gameState = initResult.result;

    // 2. Canvas-Voxel-Renderer erstellen
    const container = this.elements.gameContainer || document.getElementById("game-container");
    if (!container) throw new Error("[VOXEL_UI] #game-container nicht gefunden.");

    this.voxelRenderer = new CanvasVoxelRenderer(container);
    this.voxelRenderer.onTileClick = (info) => this._onTileClick(info);

    // 3. Erstes Render
    this.voxelRenderer.render(this.gameState, this.currentTick);

    // 4. Bau-Optionen laden
    await this._refreshBuildOptions();

    // 5. HUD initialisieren
    this._initHUD();

    // 6. Tick-Scheduler starten
    this._startTickScheduler();

    // 7. HUD-Update-Loop
    this._hudUpdateTimer = setInterval(() => this._updateHUD(), 250);
  }

  destroy() {
    this._destroyed = true;
    if (this.tickTimer)      clearInterval(this.tickTimer);
    if (this._hudUpdateTimer) clearInterval(this._hudUpdateTimer);
    if (this.voxelRenderer)  this.voxelRenderer.destroy();
  }

  // ── Tick-Scheduler ─────────────────────────────────────────────────────────

  _startTickScheduler() {
    this.tickTimer = setInterval(async () => {
      if (this._destroyed || !this.gameState) return;
      try {
        const result = await this.kernel.execute({
          domain: "game",
          action: { type: "advanceTick", payload: { state: this.gameState, ticks: 1 } }
        });
        this.gameState = result.result;
        this.currentTick = this.gameState.clock.tick;
        this.voxelRenderer.render(this.gameState, this.currentTick);
      } catch (err) {
        console.warn("[VOXEL_UI] Tick-Fehler:", err.message);
      }
    }, TICK_RATE_MS);
  }

  // ── Tile-Klick-Handler ─────────────────────────────────────────────────────

  async _onTileClick(info) {
    if (!this.gameState || this._destroyed) return;
    const { x, y } = info;

    // Inspect
    const inspectResult = await this.kernel.execute({
      domain: "query",
      action: { type: "game.inspectTile", state: this.gameState, x, y }
    });
    const inspection = inspectResult.result;

    // Wenn Struktur vorhanden -> Info anzeigen
    if (inspection.structure) {
      this._showTileInfo(inspection);
      return;
    }

    // Sonst -> Struktur bauen
    await this._buildStructure(x, y);
  }

  async _buildStructure(x, y) {
    if (!this._selectedStructure || !this.gameState) return;
    try {
      const result = await this.kernel.execute({
        domain: "game",
        action: {
          type: "placeStructure",
          payload: {
            state: this.gameState,
            x,
            y,
            structureId: this._selectedStructure
          }
        }
      });
      this.gameState = result.result;
      this.voxelRenderer.render(this.gameState, this.currentTick);
      await this._refreshBuildOptions();
      this._updateHUD();
      this._showNotification(`${this._selectedStructure} gebaut auf (${x}, ${y})`, "success");
    } catch (err) {
      this._showNotification(err.message.replace("[PLACE_STRUCTURE] ", ""), "error");
    }
  }

  async _refreshBuildOptions() {
    if (!this.gameState) return;
    try {
      const result = await this.kernel.execute({
        domain: "query",
        action: { type: "game.getBuildOptions", state: this.gameState }
      });
      this._buildOptions = result.result;
      this._renderBuildMenu();
    } catch (err) {
      console.warn("[VOXEL_UI] getBuildOptions Fehler:", err.message);
    }
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  _initHUD() {
    // Build-Auswahl-Buttons
    const buildMenu = document.getElementById("build-menu");
    if (buildMenu) {
      buildMenu.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-structure]");
        if (!btn) return;
        this._selectedStructure = btn.dataset.structure;
        document.querySelectorAll("[data-structure]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    }

    // Seed-Anzeige
    const seedEl = document.getElementById("hud-seed");
    if (seedEl && this.gameState?.world?.seed) {
      seedEl.textContent = this.gameState.world.seed;
    }

    this._updateHUD();
  }

  _updateHUD() {
    if (!this.gameState || this._destroyed) return;
    const res = this.gameState.resources || {};
    const stats = this.gameState.statistics || {};

    this._setEl("hud-ore",  Math.floor(Number(res.ore)  || 0));
    this._setEl("hud-iron", Math.floor(Number(res.iron) || 0));
    this._setEl("hud-tick", this.currentTick);
    this._setEl("hud-structures", Number(stats.structuresBuilt) || 0);

    const structs = this.gameState.structures || {};
    const mines    = Object.values(structs).filter(s => s?.id === "mine").length;
    const smelters = Object.values(structs).filter(s => s?.id === "smelter").length;
    const conveyors = Object.values(structs).filter(s => s?.id === "conveyor").length;
    this._setEl("hud-mines",    mines);
    this._setEl("hud-smelters", smelters);
    this._setEl("hud-conveyors", conveyors);

    // Build-Buttons aktualisieren (Kosten-Feedback)
    this._renderBuildMenu();
  }

  _renderBuildMenu() {
    const buildMenu = document.getElementById("build-menu");
    if (!buildMenu || this._buildOptions.length === 0) return;

    buildMenu.innerHTML = this._buildOptions.map(opt => {
      const isActive = opt.id === this._selectedStructure ? "active" : "";
      const disabled = opt.canAfford ? "" : "disabled";
      const costStr = Object.entries(opt.cost).map(([r, v]) => `${v} ${r}`).join(", ");
      return `
        <button class="build-btn ${isActive} ${disabled}"
                data-structure="${opt.id}"
                title="${opt.description}"
                ${opt.canAfford ? "" : "disabled"}>
          <span class="build-icon">${opt.icon}</span>
          <span class="build-name">${opt.name}</span>
          <span class="build-cost">${costStr}</span>
        </button>
      `;
    }).join("");
  }

  _showTileInfo(inspection) {
    const panel = document.getElementById("tile-info-panel");
    if (!panel) return;

    const tile = inspection.tile;
    const struct = inspection.structure;
    panel.innerHTML = `
      <div class="tile-info-content">
        <h3>Tile (${inspection.x}, ${inspection.y})</h3>
        <p><b>Terrain:</b> ${tile?.terrain || "?"}</p>
        <p><b>Ressource:</b> ${tile?.resource || "keine"}</p>
        ${struct ? `<p><b>Struktur:</b> ${struct.id} (Tick ${struct.builtAt})</p>` : ""}
      </div>
    `;
    panel.classList.add("visible");
    setTimeout(() => panel.classList.remove("visible"), 3000);
  }

  _showNotification(message, type = "info") {
    const el = document.getElementById("notification");
    if (!el) return;
    el.textContent = message;
    el.className = `notification ${type} visible`;
    clearTimeout(this._notifTimer);
    this._notifTimer = setTimeout(() => el.classList.remove("visible"), 2500);
  }

  _setEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
}
