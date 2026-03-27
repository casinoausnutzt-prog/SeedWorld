# Kernel Security Findings (Runde 1)

## 1) Befunde (kurz)
- **High:** Accessor-Bypass in Sanitization (`src/kernel/store/applyPatches.js`): Getter/Setter wurden bei `sanitizeForStore` implizit ausgefuehrt. Damit konnte Code in der Pflichtkette (Action/State/Patch-Werte) laufen und Guard-Grenzen umgehen.
- **Medium:** Repo-Lock Release-Race (`tools/runtime/repoLock.mjs`): Release loeschte Lock-Datei ohne Owner-Token-Pruefung; bei Owner-Wechsel/Tamper konnte ein fremder Lock entfernt werden.

## 2) Umgesetzte Patches
- `src/kernel/store/applyPatches.js`
  - Blockiert Accessor-Properties (`get`/`set`) fuer Objekte und Arrays.
  - Blockiert nicht-numerische Array-Schluessel.
  - Blockiert Sparse Arrays.
- `tools/runtime/repoLock.mjs`
  - Lock-Token jetzt via `randomUUID()` statt `Math.random()`.
  - `release()` entfernt Lock nur noch, wenn Owner-Token noch zum aktuellen Prozess-Lock passt.

## 3) Test-Erweiterungen
- `tests/modules/09.store-and-governance-gates.module.mjs`
  - Regressionsfall: Payload-Getter wird geblockt und **nicht** ausgefuehrt.
  - Regressionsfall: State-Getter in `governance.llm-chain` wird geblockt und **nicht** ausgefuehrt.
- `tests/modules/10.traceability-policy-lock.module.mjs`
  - Regressionsfall: Fremder Lock bleibt nach Release erhalten (kein Loeschen fremder Ownership).

## 4) Konflikte mit bestehenden Plaenen (UI/Mechanics/UX)
- Kein direkter Konflikt in UI/Mechanics/UX-Logik.
- Indirekt relevant: Strikteres Sanitizing lehnt nun Accessor-basierte Datenmodelle ab; falls Plan-Docs solche Strukturen vorsehen, muessen sie auf reine Datenobjekte umgestellt werden.

## 5) Machbarkeitsbelege
- Isolierte Modul-Ausfuehrung erfolgreich:
  - `tests/modules/09.store-and-governance-gates.module.mjs`
  - `tests/modules/10.traceability-policy-lock.module.mjs`
- Sync-Tools erfolgreich ausgefuehrt:
  - `node tools/runtime/updateFunctionSot.mjs`
  - `node tools/runtime/updateTraceLock.mjs`
- Hinweis: `npm test` scheitert derzeit global an bestehender Preflight-Blueprint-Policy (`[PREFLIGHT][BLUEPRINT_POLICY]` in `docs/UI_PLAN.md`), nicht an diesen Security-Patches.

## 6) Verbleibende Risiken
- **Residual:** Bereits vor Guard-Aufruf gecachte Referenzen (`const r = Math.random`) sind in-process prinzipbedingt schwer vollstaendig blockierbar. Aktuell mitigiert durch harte Eingangsvalidierung/Sanitization, aber kein vollstaendiger VM-Isolationsersatz.
