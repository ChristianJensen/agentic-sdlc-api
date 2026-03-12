# Task Tracker API

Express REST API for task management. In-memory store (no database).

## Quick Reference

```bash
npm start          # Start on port 3001
npm test           # Run tests
```

## Conventions

- **TDD**: Write tests first in `tests/`. Run `npm test` before committing.
- **Pure functions**: Keep route handlers thin. Extract logic into modules under `src/`.
- **No database**: Data lives in-memory (Map). Restarting clears all tasks.
- **API contract**: Must match `../framework/contracts/tasks-api.json` (OpenAPI spec).
- **Error responses**: Always return `{ error: "message" }` with appropriate HTTP status.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /tasks | List all tasks |
| GET | /tasks/:id | Get task by ID |
| POST | /tasks | Create task (body: `{ title }`) |
| PATCH | /tasks/:id | Update task (body: `{ title?, completed? }`) |
| DELETE | /tasks/:id | Delete task |

## Task Schema

```json
{
  "id": 1,
  "title": "string",
  "completed": false,
  "createdAt": "ISO 8601"
}
```

## Agent Workflow (Git Queue)

Work is coordinated via the Git-native task queue at `../framework/queue/`.

### Finding work

Task files are Markdown with YAML frontmatter. Filter by `target-repo: api` and `status: ready`.

```bash
# Refresh the queue
git -C ../framework pull --ff-only

# Check what's already claimed
git ls-remote origin 'refs/heads/agent/*'
```

### Branch naming

`agent/<intent>-w<wave>-<task-slug>` — derived from the queue file path.

### Claiming a task

```bash
git checkout -b agent/<slug> origin/main
git commit --allow-empty -m "claim: <agent-id>"
git push origin agent/<slug>   # atomic — first push wins
```

### Creating a PR

PRs must include context links and labels:

```bash
gh pr create \
  --title "[<intent> wave <N>] <description>" \
  --body "## Context
- **Intent Spec:** [link to intent]
- **Task:** [link to task file]
- **Contract:** [link to contract]

## What this PR does
<description>

## Acceptance Criteria
<from task file>"
```

### Discovered sub-work

If you discover additional work needed, create a new task file in `../framework/queue/<intent>/` following the template at `../framework/templates/task-queue-item.md`.
