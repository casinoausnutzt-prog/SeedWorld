# TEM System Standards: SeedWorld Engine V3

Das Task Entry Matrix (TEM) System dient der strukturierten Erfassung, Verfolgung und Validierung von Aufgaben in der SeedWorld-Engine. Es ist direkt mit dem LLM-Preflight-Prozess verknüpft.

## 1. Task-Struktur (Schema 2.0.0)

Jede Aufgabe wird als JSON-Datei im Verzeichnis `tem/tasks/open/` gespeichert.

| Feld | Beschreibung |
| :--- | :--- |
| `schema_version` | Aktuelle Version des Task-Schemas (z.B. `2.0.0`). |
| `task_id` | Eindeutige ID der Aufgabe (z.B. `ARC-001`, `BUG-001`). |
| `title` | Kurzer, prägnanter Titel der Aufgabe. |
| `status` | Aktueller Status (`open`, `in-progress`, `completed`, `archived`). |
| `track` | Themenbereich der Aufgabe (z.B. `runtime-stability`, `gameplay-mechanics`). |
| `source_docs` | Liste der betroffenen Quelldateien oder Dokumente. |
| `description` | Detaillierte Beschreibung der Aufgabe und der zu lösenden Probleme. |
| `evidence` | Beweise für das Problem (z.B. Code-Stellen, Fehlermeldungen). |
| `scope_paths` | Liste der Dateipfade, die im Rahmen der Aufgabe geändert werden dürfen. |
| `match_policy` | Validierungsregel für die Änderungen (z.B. `all_scope_paths_touched`). |

## 2. Integration mit LLM-Preflight

Der LLM-Preflight-Prozess nutzt die Informationen aus den TEM-Tasks, um die Änderungen eines Agenten zu validieren:

1.  **Scope-Validierung**: Die geänderten Pfade des Agenten müssen mit den `scope_paths` der aktiven Aufgabe übereinstimmen.
2.  **Policy-Prüfung**: Die `match_policy` der Aufgabe wird am Ende des Preflights geprüft.
3.  **Entry-Verknüpfung**: Jede Aufgabe kann spezifische `ENTRY.md` Dokumente erfordern, die im Preflight validiert werden.

## 3. Workflow für neue Aufgaben

1.  **Erstellung**: Neue Aufgaben werden als JSON-Datei in `tem/tasks/open/` angelegt.
2.  **Aktivierung**: Ein Agent übernimmt eine Aufgabe, indem er sie in seinen Preflight-Prozess einbindet.
3.  **Abschluss**: Nach erfolgreicher Validierung und Merge wird die Aufgabe nach `tem/tasks/archive/` verschoben.

## 4. Governance & Testline

Alle TEM-Tasks werden automatisiert in der `testline` geprüft. Eine Aufgabe gilt erst dann als abgeschlossen, wenn alle zugehörigen Tests und Governance-Checks erfolgreich durchlaufen wurden.
