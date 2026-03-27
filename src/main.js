import { GameLogicController } from "./game/GameLogicController.js";
import { UIController } from "./ui/UIController.js";

const gameLogic = new GameLogicController(null, { domain: "game" });

const ui = new UIController({
  gameLogic,
  elements: {
    tileGridContainer: document.querySelector("#tile-grid-container"),
    resourceBar: document.querySelector("#resource-bar"),
    statusValue: document.querySelector("#status-value"),
    summaryValue: document.querySelector("#summary-value"),
    stateValue: document.querySelector("#state-value"),
    selectionValue: document.querySelector("#selection-value"),
    buildActions: document.querySelector("#build-actions"),
    homeButton: document.querySelector("#nav-home"),
    patcherButton: document.querySelector("#nav-patcher")
  }
});

if (typeof window !== "undefined") {
  window.seedWorldUI = ui;
}

ui.bootstrap();
