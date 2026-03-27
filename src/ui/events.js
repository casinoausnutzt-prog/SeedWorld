export class ResourceBar {
  constructor(container) {
    if (!container) {
      throw new Error("[RESOURCE_BAR] container fehlt.");
    }
    this.container = container;
  }

  render(model = {}) {
    const items = [
      { label: "Erz", value: `${model.ore || 0} / ${model.storageCapacity || 0}` },
      { label: "Eisen", value: String(model.iron || 0) },
      { label: "Tick", value: String(model.tick || 0) },
      { label: "Sekunden", value: String(model.secondsElapsed || 0) },
      { label: "Abbauer", value: String(model.miners || 0) },
      { label: "Lager", value: String(model.storages || 0) },
      { label: "Schmelzen", value: String(model.smelters || 0) }
    ];

    this.container.replaceChildren(
      ...items.map((item) => {
        const chip = document.createElement("div");
        chip.className = "resource-chip";

        const label = document.createElement("span");
        label.className = "resource-chip__label";
        label.textContent = item.label;

        const value = document.createElement("strong");
        value.className = "resource-chip__value";
        value.textContent = item.value;

        chip.append(label, value);
        return chip;
      })
    );
  }
}
