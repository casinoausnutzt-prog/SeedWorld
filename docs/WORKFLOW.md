# WORKFLOW

Verbindlicher Patch-Workflow:

1. Intake (ZIP oder Manifest)
2. Orchestrierung in genau einer terminal-exklusiven Session
3. Ergebnis mit klaren Logs/Summary

## Regeln

- Einziger kanonischer Einstieg: `npm run patch:apply -- --input <path>`
- Write Authority liegt nur im Terminal-Orchestrator.
- Browser ist nur Control Plane (start/status/log/result/cancel).
- `llm:*` Gates laufen nur terminal-exklusiv innerhalb der Session.
- Hard lock + deadman verhindern parallele Write-Sessions.
- Fail-closed: bei Gate/Lock/Validation-Fehler wird nicht geschrieben.
- Vor Apply wird Backup erstellt; bei Fehler erfolgt Rollback auf `failed_rolled_back` oder `failed_partial`.
