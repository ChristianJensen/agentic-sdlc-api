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

## Agent Workflow (yx)

```bash
yx ls --format json          # See available work
yx state "task name" wip     # Claim a task
yx done "task name"          # Mark complete
yx add "subtask" --under "parent"  # Discovered sub-work
yx sync                      # Push/pull task state
```
