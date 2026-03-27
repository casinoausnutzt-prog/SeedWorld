# SeedWorld Scope v1

## Ziel
Lokaler Prototyp eines mobilen Sandbox-Management-Spiels mit reproduzierbarer Simulation.

## Verbindliche Anforderungen
- Deterministischer Kernel:
  - Gleicher Seed erzeugt identische Tick-States.
  - Verschiedene Seeds erzeugen unterschiedliche Fingerprints.
- Seed-Validierung:
  - `seed -> SHA-256` wird berechnet und angezeigt.
  - Zwingender Hash-Abgleich (`seedHash`) meldet OK/Mismatch und blockiert bei Abweichung.
- MUT-Fingerprint:
  - Fingerprint aus kanonisch serialisiertem Kernel-Payload.
  - Hash-Algorithmus: SHA-256.
- Mobile Optimierung:
  - Mobile-first Layout.
  - Touch-freundliche Inputs/Buttons.

## Out of Scope (v1)
- Backend/DB
- Multiplayer/Sync
- Persistenz von Saves
- Produktions-Build-Pipeline

## Technischer Rahmen
- Plain HTML/CSS/JavaScript (ohne externe Abhaengigkeiten)
- Lokaler Start per `python3 -m http.server 8080`
