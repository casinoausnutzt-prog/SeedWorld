# Entwicklungsablauf

## Standard-Flow

```text
1) Lesen
2) Preflight
3) Schreiben
4) Sync
5) Test
6) Commit
```

## Praktische Befehle

```bash
npm run llm:classify -- --paths src/ui/UIController.js
npm run llm:entry -- --paths src/ui/UIController.js
npm run llm:ack -- --paths src/ui/UIController.js
npm run llm:check -- --paths src/ui/UIController.js
npm run sync:docs
npm test
```

## Commit-Regel

- Änderungen atomar und klein halten.
- Keine Sammel-Commits mit vielen Themen.
