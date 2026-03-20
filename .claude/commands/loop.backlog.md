---
description: "Manage the project backlog. Usage: /loop.backlog, /loop.backlog add <idea>, /loop.backlog pick <#>"
---

## User Input

```text
$ARGUMENTS
```

## Instructions

Manage `specs/backlog.md` — the project's idea backlog.

### Parse the command

| Input pattern | Mode | Example |
|--------------|------|---------|
| _(empty)_ | **View** the backlog | `/loop.backlog` |
| `add <idea>` | **Add** a new item | `/loop.backlog add OAuth2 support` |
| `pick <#>` | **Pick** an item to work on | `/loop.backlog pick 3` |

### Mode: VIEW

1. Read `specs/backlog.md`
2. Display the active items table
3. Note how many items are in each priority level
4. If any items are marked as coming from task closures, highlight those

### Mode: ADD

1. Read `specs/backlog.md`
2. Find the next available item number
3. Append a new row to the Active Items table:
   - `#`: next number
   - `Description`: from the user's input
   - `Source`: `manual`
   - `Priority`: `P2` (default, user can change later)
   - `Added`: today's date (YYYY-MM-DD)
4. Confirm what was added

### Mode: PICK

1. Read `specs/backlog.md`
2. Find the item with the given number
3. Move it from "Active Items" to "Picked Up" with today's date
4. Immediately invoke the `/loop.build new` flow with the item's description
