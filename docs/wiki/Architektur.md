# Architektur

## Gesamtbild

```text
+-------------------+      +-----------------------+      +----------------------+
| UIController      | ---> | GameLogicController   | ---> | KernelController     |
| - Input/Output    |      | - Aktion -> Patches   |      | - Validierung + Write|
+-------------------+      +-----------------------+      +----------------------+
                                                                  |
                                                                  v
                                                       +------------------------+
                                                       | applyPatches + Guards  |
                                                       +------------------------+
```

## Warum diese Trennung?

- UI bleibt einfach und austauschbar.
- Spielregeln bleiben getrennt vom Sicherheitskern.
- Kernel bleibt zentrale Kontrolle gegen Bypässe.

## Determinismus

Gleiche Eingabe + gleicher Zustand -> gleiches Ergebnis.

```text
Input A + State S = Output X
Input A + State S = Output X   (immer gleich)
```
