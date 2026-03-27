import { TileGridRenderer } from "./TileGridRenderer.js";
import { ResourceBar } from "./events.js";

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

export class UIController {
  constructor({ gameLogic, elements = {} } = {}) {
    if (!gameLogic || typeof gameLogic.createInitialState !== "function") {
      throw new Error("[UI_CONTROLLER] gameLogic erforderlich.");
    }

    this.gameLogic = gameLogic;
    this.elements = elements;
    this.currentState = this.gameLogic.createInitialState();
    this.selectedTile = null;
    this.tickTimer = null;
    this.tileGridRenderer = null;
    this.resourceBar = null;
  }

  bootstrap() {
    this.#ensureRenderer();
    this.#ensureResourceBar();
    this.#bindNavigation();
    this.#renderAll();
    this.#startTickLoop();
  }

  destroy() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  #ensureRenderer() {
    if (this.tileGridRenderer) {
      return;
    }

    const world = this.currentState.world;
    this.tileGridRenderer = new TileGridRenderer(this.elements.tileGridContainer, world.width, world.height, 84);
    this.tileGridRenderer.onTileClick(({ x, y }) => {
      this.selectedTile = { x, y };
      this.#renderSelection();
      this.#renderBuildActions();
      this.#renderGrid();
    });
  }

  #ensureResourceBar() {
    if (!this.resourceBar && this.elements.resourceBar) {
      this.resourceBar = new ResourceBar(this.elements.resourceBar);
    }
  }

  #bindNavigation() {
    if (this.elements.homeButton) {
      this.elements.homeButton.addEventListener("click", () => {
        window.location.href = "./index.html";
      });
    }

    if (this.elements.patcherButton) {
      this.elements.patcherButton.addEventListener("click", () => {
        window.location.href = "./patchUI.html";
      });
    }
  }

  #startTickLoop() {
    const intervalMs = this.gameLogic.getTickMs();
    this.tickTimer = setInterval(() => {
      this.currentState = this.gameLogic.advanceTick(this.currentState, 1);
      this.#renderHud();
      this.#renderStatusTexts();
      this.#renderStateDump();
      this.#renderGrid();
      this.#renderBuildActions();
    }, intervalMs);
  }

  #renderAll() {
    this.#renderHud();
    this.#renderStatusTexts();
    this.#renderSelection();
    this.#renderBuildActions();
    this.#renderStateDump();
    this.#renderGrid();
  }

  #renderHud() {
    if (this.resourceBar) {
      this.resourceBar.render(this.gameLogic.getHudModel(this.currentState));
    }
  }

  #renderStatusTexts() {
    setText(this.elements.statusValue, this.currentState.meta?.statusText || "-");
    setText(this.elements.summaryValue, this.currentState.meta?.summaryText || "-");
  }

  #renderSelection() {
    if (!this.selectedTile) {
      setText(this.elements.selectionValue, "Kein Feld ausgewaehlt");
      return;
    }

    const info = this.gameLogic.inspectTile(this.currentState, this.selectedTile);
    setText(this.elements.selectionValue, `${info.title}: ${info.summary}`);
  }

  #renderStateDump() {
    setText(this.elements.stateValue, pretty(this.gameLogic.getStateSnapshot(this.currentState)));
  }

  #renderGrid() {
    if (this.tileGridRenderer) {
      this.tileGridRenderer.render(this.currentState, this.selectedTile);
    }
  }

  #renderBuildActions() {
    const container = this.elements.buildActions;
    if (!container) {
      return;
    }

    container.replaceChildren();

    if (!this.selectedTile) {
      const hint = document.createElement("p");
      hint.className = "build-actions__hint";
      hint.textContent = "Klicke ein Feld an, um moegliche Gebaeude zu sehen.";
      container.append(hint);
      return;
    }

    const info = this.gameLogic.inspectTile(this.currentState, this.selectedTile);
    const options = this.gameLogic.getBuildCatalog(this.currentState, this.selectedTile);

    const title = document.createElement("p");
    title.className = "build-actions__title";
    title.textContent = `${info.title} (${this.selectedTile.x}, ${this.selectedTile.y})`;
    container.append(title);

    if (options.length === 0) {
      const hint = document.createElement("p");
      hint.className = "build-actions__hint";
      hint.textContent = info.summary;
      container.append(hint);
      return;
    }

    for (const option of options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "build-action-button";
      button.disabled = !option.allowed;
      button.innerHTML = `<strong>${option.label}</strong><span>${option.price?.label || "-"}</span>`;
      button.title = option.reason || "";
      button.addEventListener("click", () => {
        const result = this.gameLogic.placeStructure(this.currentState, {
          type: option.type,
          x: this.selectedTile.x,
          y: this.selectedTile.y
        });
        this.currentState = result.state;
        this.#renderAll();
      });
      container.append(button);

      const note = document.createElement("p");
      note.className = "build-actions__note";
      note.textContent = option.reason || "";
      container.append(note);
    }
  }
}
