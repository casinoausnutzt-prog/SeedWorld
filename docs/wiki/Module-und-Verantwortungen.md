# Module und Verantwortungen

## `src/kernel/`

- **KernelController**: einziger Write-Weg
- Pfad-/Domain-Whitelist
- Schema- und Sanitizing-Prüfung
- Determinismus-Guards

## `src/game/`

- **GameLogicController**
- berechnet Patch-Vorschläge aus Aktionen
- schreibt nie direkt

## `src/ui/`

- **UIController**
- Event-Verkabelung und Anzeige
- TileGridRenderer + tick-basierte Animationen
- keine Spielregel-Berechnung

## `docs/llm/`

- Entry/Task/Lock für LLM-Arbeit
- technische Preflight-Kette: `classify -> entry -> ack -> check`

## `docs/sot/`

- verbindliche SoT-Texte für Kernel, GameLogic, UI
