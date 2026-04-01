// @doc-anchor ENGINE-CORE
// Voxel-Factorio-Light MVP Einstiegspunkt.
// Nutzt KernelController + VoxelUIController (ersetzt UIController + TileGridRenderer).

import { KernelController } from "./kernel/KernelController.js";
import { VoxelUIController } from "./ui/VoxelUIController.js";

const kernel = new KernelController({ seed: "seedworld-v1" });

const ui = new VoxelUIController({
  kernel,
  elements: {
    gameContainer: document.querySelector("#game-container")
  }
});

ui.bootstrap().catch(err => {
  console.error("[VOXEL_MAIN] Bootstrap fehlgeschlagen:", err);
  const errEl = document.getElementById("error-overlay");
  if (errEl) {
    errEl.textContent = `Fehler: ${err.message}`;
    errEl.style.display = "block";
  }
});
