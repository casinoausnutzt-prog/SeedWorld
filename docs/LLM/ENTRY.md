# LLM Entry

Dieses Entry-Dokument ist der verpflichtende Einstieg fuer alle Arbeiten im Repo.

- Absoluter Pfad: `C:\Users\Vannon\Downloads\SeedWorld-main (1)\SeedWorld-main\docs\LLM`
- Zweck: Bindeglied zwischen Projektindex und LLM-Policy.

## Pflicht-Lesereihenfolge

1. `docs/INDEX.md`
2. `docs/LLM/ENTRY.md`
3. `docs/LLM/POLICY.md`
4. `docs/LLM/AKTUELLE_RED_ACTIONS.md`

## Arbeitsweise (atomar verpflichtend)

1. Ein Scope pro Arbeit (keine Mischthemen im selben Commit).
2. Vor Commit immer Gegenpruefung durch Guard/Hooks.
3. Jeder Blocker aus Gate/Review muss als Task in `tem/tasks/open/*.json` materialisiert sein.
4. LLM/Sub_Agent sind Governance-Pflichtpfad, aber nicht Runtime-Simulationspfad.

## Runtime-Enforcement

- `npm run llm:entry` schreibt einen ACK-Status mit Docs-Hash. Das ist der Read-Schritt, der den Guard erst sinnvoll macht.
- `npm run llm:guard -- --action <stage|commit|push>` blockiert Stage/Commit/Push bei Hash-Drift, fehlendem ACK oder kaputter Read-Reihenfolge.
- `llm:entry` und `llm:guard` sind zusammen der verbindliche Read/Commit/Push-Gate-Pfad.
- `npm run governance:llm:verify` und `npm run governance:subagent:verify` sind Pflichtgates.
- Hooks pruefen das standardmaessig vor jedem Commit/Push.
- `docs/LLM/AKTUELLE_RED_ACTIONS.md` wird vor Preflight/Commit synchronisiert und dokumentiert den Commit-Kandidaten.
- `npm run preflight` nutzt einen automatischen Preflight-Guard, der den Pflichtlauf fail-closed haelt, bis die aktuelle Guard-Abweichung behoben wurde.

## Ruecklaeufigkeit (Rollback/Revert)

- Revert-/Rollback-Commits haben keinen Sonderpfad.
- Sie muessen denselben Required-Verify-Contract bestehen wie Forward-Commits.

## 3x Override-Regel (nur Notfall)

Ohne ausdrueckliche Arbeitsanweisung darf nicht gestaged/committed/gepusht werden.
Ein Override ist nur nach 3 expliziten Bestaetigungen erlaubt:

```bash
npm run llm:override -- --action commit --reason "<begruendung>"
```

Dies muss 3x mit identischer Begruendung ausgefuehrt werden. Vorher bleibt der Guard auf BLOCK.

Warnlogik bei Verstoß:
1. `ACHTUNG DU COMMITEST/STAGEST/PUSHT "XXX" - das verstoesst auf basis von XXX gegen deine regeln`
2. dieselbe Warnung
3. dieselbe Warnung
4. `NOCHMAL FUER DUMM: ... sicher?`
