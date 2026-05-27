# Contributing

## Commit messages

Conventional Commits + BMad task-ID prefix in the scope:

    <type>(<task-id>): <imperative subject>

Examples:

- `chore(E1.1): bootstrap Expo SDK 56 scaffold + EAS config`
- `feat(E2.2): wire DescribeService to OpenRouter`
- `fix(E3.1): correct utterance router false-positive on "Lola"`
- `refactor(E5.4): extract canonicalization to its own module`

### Types

`feat` · `fix` · `chore` · `docs` · `refactor` · `test` · `perf`

### Task ID

The task ID is the story ID (`E1.1`, `E2.3`, etc.) from the implementation backlog
at `_bmad-output/planning-artifacts/epics-and-stories/`. Cross-cutting work that
doesn't map to a single story may use the epic ID (`E1`) or omit the scope entirely.

## Project layout

| Path | Purpose |
|---|---|
| `_bmad/` | BMad framework (installer-managed; do not edit) |
| `_bmad-output/planning-artifacts/` | Brief, addendum, PRD, architecture, epics & stories |
| `_bmad-output/implementation-artifacts/` | Sprint plan, story specs, validation reports |
| `app/` | Expo SDK 56 application (Lola v0.9) |
| `docs/validation/` | Pre-MVP validation results (V1–V4) |
| `docs/runbooks/` | Operational runbooks (sideload, TestFlight, etc.) |

## Story workflow

The dev cycle per story:

1. `bmad-create-story` — write the spec
2. `bmad-create-story:validate` — adversarial review of the spec
3. `bmad-dev-story` — implement
4. `bmad-code-review` — review the diff
5. Loop to (3) if issues; otherwise next story

ClickUp Tasks under the **MVP** and **Sprint N** Lists track real-time status.
