# LLM Policy

## Default-Pflichten

1. Pflicht-Lesereihenfolge strikt einhalten; der Read endet mit `npm run llm:entry`, damit ein frischer ACK fuer den Guard existiert.
2. `npm run llm:guard -- --action <stage|commit|push>` ist der verbindliche Read/Commit/Push-Gate und blockiert bei Hash-Drift oder fehlendem ACK.
3. Nur atomare Arbeitspakete umsetzen.
4. Vor Commit lokal `npm run llm:guard -- --action commit` und `npm run check:required` ausfuehren (Default ist `verify-first`; Sync/Materialize nur per explizitem Modus).
5. Vor Push `npm run llm:guard -- --action push` und `npm run check:required:verify-only` bestehen (ebenfalls `verify-first`, kein Auto-Write).
6. Zero-Trust: Claims nur aus Gate-Output + `runtime/evidence/required-check-report.json` + `runtime/evidence/governance-proof-manifest.json` ableiten.
7. Governance-Vertrag kommt aus `app/src/kernel/GovernanceEngine.js`; SoT-2.0-Mapping aus `app/src/sot/governance-engine.sot.v2.json`.
8. Jeder Blocker aus Required-Report oder Subagent-Review muss als Task materialisiert und pruefbar sein.
9. `docs/LLM/` und `Sub_Agent/` sind Pflicht-Governance-Domain, aber nicht Runtime-Simulation.

## Commit-Blocker

- Fehlender ACK-Status (`runtime/.patch-manager/llm-read-state.json`)
- Fehlender oder veralteter `llm:guard`-Pass nach einem Read-ACK
- Hash-Mismatch zwischen ACK und Pflichtdokumenten
- Fehlende Runtime-Gegenpruefung
- Fehlende oder invalide Test-Evidence
- Testline-Integritaetsverletzung (Hash-Drift, Injection-Muster, Anti-Determinismus/BYPASS-Spuren)
- Fehlender oder invalider `runtime/evidence/required-check-report.json`
- Fehlender oder invalider `runtime/evidence/governance-findings.json`
- Fehlender oder invalider `runtime/evidence/governance-proof-manifest.json`
- Verify-Gate nicht komplett gruen (`llm:guard -> versioning -> policy -> llm -> subagent -> findings -> tests -> evidence -> testline -> hygiene -> docs:v2 -> docs:tasks -> coverage`)

## Push-Sicherheitsregeln (verbindlich)

- `git push --force` und `git push --force-with-lease` sind verboten.
- Non-fast-forward Pushes (History-Rewrite) sind verboten.
- Remote-Ref-Löschungen via Push (`:<branch>`) sind verboten.
- `pre-push` blockiert diese Fälle mechanisch und erzwingt `check:required:verify-only`.
- Revert-/Rollback-Commits haben denselben Gate-Vertrag wie Forward-Commits (kein Bypass).

## Standardbefehle

```bash
npm run llm:entry
npm run llm:guard -- --action commit
npm run llm:guard -- --action push
npm run check:required
npm run check:required:verify-only
npm run governance:policy:verify
npm run governance:llm:verify
npm run governance:subagent:verify
npm run governance:findings:verify
npm run versioning:verify
```
