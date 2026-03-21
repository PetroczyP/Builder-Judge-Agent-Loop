---
name: pr-review
description: >
  Monitor a PR for AI reviewer comments (CodeRabbit, Auggie, Copilot, humans),
  validate each finding, fix valid ones or dismiss with explanation, batch commit,
  push, and resolve threads. Use when the user says "review PR", "fix PR comments",
  "address review feedback", or after creating a PR that has pending reviews.
allowed-tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash(gh *)
  - Bash(git *)
  - Bash(cat /tmp/*)
  - Bash(npm *)
  - Agent
  - Skill
---

# PR Review Monitor & Auto-Fix

Detect the current PR, fetch unresolved review threads from all AI reviewers and humans,
validate each finding with technical rigor, apply valid fixes (or dismiss with explanation),
batch commit, push, and resolve threads.

---

## Constants

| Parameter | Value |
|-----------|-------|
| Max review-fix iterations | **3** |
| Repo | Auto-detected from `gh repo view --json nameWithOwner -q .nameWithOwner` |

---

## GraphQL Gotcha

**All GraphQL queries MUST be written to a temp file first**, then referenced with `cat`:

```bash
cat > /tmp/query.graphql << 'GRAPHQL'
query($owner: String!, $name: String!, $pr: Int!) {
  ...
}
GRAPHQL

gh api graphql \
  -F owner="OWNER" -F name="REPO" -F pr=NUMBER \
  -f query="$(cat /tmp/query.graphql)"
```

Inline queries with single quotes fail with `Expected VAR_SIGN, actual: UNKNOWN_CHAR`.

---

## Step 1 — Detect Active PR

```bash
gh pr view --json number,title,state,url,headRefName -q '{number, title, state, url, branch: .headRefName}'
```

If no open PR exists on the current branch, stop and tell the user to push and open one first.

Store the PR number and repo owner/name for all subsequent commands.

---

## Step 2 — Fetch Unresolved Review Threads

> **IMPORTANT — Large Response Handling:**
> PRs with many Copilot/CodeRabbit comments can produce hundreds or thousands of lines
> of JSON. The GraphQL response MUST be saved to a temp file and parsed with Python.
> NEVER try to read raw GraphQL JSON output directly — it will be truncated or overwhelming.

### 2a. Fetch threads with pagination

The query paginates (`after` cursor) to handle PRs with 100+ threads:

```bash
cat > /tmp/pr-threads.graphql << 'GRAPHQL'
query($owner: String!, $name: String!, $pr: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          startLine
          diffSide
          comments(first: 5) {
            nodes {
              id
              body
              author { login }
              createdAt
            }
          }
        }
      }
    }
  }
}
GRAPHQL
```

Fetch the first page, then follow `pageInfo.hasNextPage` / `endCursor` for subsequent pages.
Save **each page** to a temp file and use Python to merge, filter, and extract:

### 2b. Parse and filter with Python

```bash
# Save raw response
gh api graphql \
  -F owner="$OWNER" -F name="$REPO" -F pr=$PR_NUMBER \
  -f query="$(cat /tmp/pr-threads.graphql)" > /tmp/pr-threads-raw.json

# Parse: filter to unresolved, extract key fields, group by source
# NOTE: Do NOT filter by isOutdated — outdated threads are still visible on GitHub
# and need to be resolved. Mark them so they can be auto-dismissed if already fixed.
python3 -c "
import json, sys

with open('/tmp/pr-threads-raw.json') as f:
    data = json.load(f)

threads = data['data']['repository']['pullRequest']['reviewThreads']['nodes']
page_info = data['data']['repository']['pullRequest']['reviewThreads']['pageInfo']

unresolved = [
    {
        'thread_id': t['id'],
        'path': t['path'],
        'line': t['line'],
        'start_line': t['startLine'],
        'author': t['comments']['nodes'][0]['author']['login'] if t['comments']['nodes'] else 'unknown',
        'body': t['comments']['nodes'][0]['body'] if t['comments']['nodes'] else '',
        'comment_count': len(t['comments']['nodes']),
    }
    for t in threads
    if not t['isResolved']
]

# Mark outdated threads for easy identification
for u in unresolved:
    tid = u['thread_id']
    t_obj = next(t for t in threads if t['id'] == tid)
    u['is_outdated'] = t_obj['isOutdated']

# Classify source
for u in unresolved:
    login = u['author']
    if 'coderabbit' in login:
        u['source'] = 'CodeRabbit'
    elif 'copilot' in login:
        u['source'] = 'Copilot'
    elif login == 'github-actions[bot]':
        u['source'] = 'Auggie'
    else:
        u['source'] = 'Human'

result = {
    'unresolved_count': len(unresolved),
    'has_next_page': page_info['hasNextPage'],
    'end_cursor': page_info['endCursor'],
    'threads': unresolved,
}
print(json.dumps(result, indent=2))
" > /tmp/pr-threads-parsed.json
```

**If `has_next_page` is true**, re-run the GraphQL query with `-F after="END_CURSOR"` and
merge results. Repeat until all pages are fetched.

Read `/tmp/pr-threads-parsed.json` to get the clean, filtered thread list.
Only the `body` of the **first comment** in each thread is extracted (the original finding) —
this keeps output small. If you need follow-up comments in a thread, fetch them individually
when processing that specific thread in Step 3.

### 2c. Group by source and report counts

Before processing, report a summary to the user:

```
Found <N> unresolved threads:
  Copilot: <n>
  CodeRabbit: <n>
  Auggie: <n>
  Human: <n>
```

If zero unresolved threads, also check issue comments (Step 2d) before reporting "nothing to review."

### 2d. Fetch AI Issue Comments (Auggie, CodeRabbit summaries)

Some AI reviewers post findings as **issue comments** rather than review threads
(Auggie posts via GitHub Actions, CodeRabbit posts walkthrough summaries).

```bash
# Save to file — issue comment responses can also be very large
gh api repos/{owner}/{repo}/issues/{pr_number}/comments --paginate > /tmp/pr-issue-comments-raw.json

# Parse with Python — extract only AI bot comments
python3 -c "
import json

with open('/tmp/pr-issue-comments-raw.json') as f:
    comments = json.load(f)

ai_comments = [
    {'id': c['id'], 'author': c['user']['login'], 'created': c['created_at'], 'body_preview': c['body'][:500]}
    for c in comments
    if (c['user']['login'] == 'github-actions[bot]' and any(kw in c['body'].lower() for kw in ['augment', 'auggie', 'review']))
    or c['user']['login'] == 'coderabbitai[bot]'
]
print(json.dumps(ai_comments, indent=2))
" > /tmp/pr-issue-comments-parsed.json
```

Parse the **latest** comment from each bot for actionable findings.
Since issue comments cannot be resolved via API, reply with a summary comment after processing (Step 4).

> **Note on `body_preview`**: Only the first 500 chars are stored in the parsed output.
> When processing a specific finding in Step 3, fetch the full comment body individually
> using `gh api repos/{owner}/{repo}/issues/comments/{comment_id} -q .body`.

---

## Step 3 — Process ALL Unresolved Threads (Batch)

> **IMPORTANT:** Process ALL threads before committing. Do NOT commit after each fix.
> This reduces CI triggers from N to 1.

For **each** review thread or AI finding:

### 3a. Read Context

Open the file at `path`, read +/- 15 lines around the reported `line`. If `line` is null, read the most relevant section.

### 3b. Validate

Invoke `superpowers:receiving-code-review` to process each suggestion with technical rigor.

**Do NOT blindly implement suggestions.** For each one:

1. **Verify** the suggestion is technically correct by reading the actual code
2. **Evaluate** whether it aligns with project conventions (CLAUDE.md, constitution, existing patterns)
3. **Check** if the referenced code still exists and hasn't already been changed
4. **Consider** whether the fix would break tests or other functionality

Apply these checks:

| Check | If fails |
|-------|----------|
| File/line still exists in current branch | Dismiss — already changed |
| Suggestion is technically correct | Dismiss — explain why it's wrong |
| Aligns with project conventions (CLAUDE.md, constitution) | Dismiss — cite the convention |
| Not a stylistic nitpick on intentional code | Dismiss — explain intent |
| Fix would not break existing tests | Dismiss or adapt |
| Suggestion is not a duplicate of another thread | Dismiss — reference the other thread |

### 3c. If Valid — Fix and Stage

1. Edit the file to apply the suggested change
2. Verify the edit (re-read affected lines)
3. Stage the file: `git add <path>`
4. Record the thread ID for later resolution (do NOT resolve yet)
5. Track: `fixed: <path>#L<line> — <short description>`

### 3d. If Not Valid — Dismiss with Reply

Reply to the thread explaining why:

```bash
cat > /tmp/dismiss-reply.graphql << 'GRAPHQL'
mutation($threadId: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
    comment { id }
  }
}
GRAPHQL

gh api graphql \
  -F threadId="THREAD_ID" \
  -F body="Dismissing: <explanation>" \
  -f query="$(cat /tmp/dismiss-reply.graphql)"
```

Then resolve the thread:

```bash
cat > /tmp/resolve-thread.graphql << 'GRAPHQL'
mutation($threadId: ID!) {
  resolveReviewThread(input: { threadId: $threadId }) {
    thread { id isResolved }
  }
}
GRAPHQL

gh api graphql \
  -F threadId="THREAD_ID" \
  -f query="$(cat /tmp/resolve-thread.graphql)"
```

Track: `dismissed: <path>#L<line> — <reason>`

### 3e. Repeat for ALL remaining threads before proceeding to Step 4

---

## Step 4 — Run Tests, Batch Commit, Push, Resolve

### 4a. Run Tests

```bash
# Run the project's test suite
npm test 2>&1
```

If tests fail, identify which fix caused the failure, revert it (`git checkout -- <file>`), dismiss that thread with explanation, and re-run tests.

### 4b. Commit and Push

```bash
# Only if there are staged changes (rounds with only dismissals skip this)
if ! git diff --cached --quiet; then
  git commit -m "fix: address PR review round <N> — <count> fixes"
  git push
fi
```

### 4c. Resolve Fixed Threads

After successful push, resolve all threads that were fixed:

```bash
# For each fixed thread ID:
gh api graphql \
  -F threadId="THREAD_ID" \
  -f query="$(cat /tmp/resolve-thread.graphql)"
```

### 4d. Reply to AI Issue Comments

For findings from issue comments (Auggie, CodeRabbit summaries), post a reply:

```bash
gh pr comment <PR_NUMBER> --body "**Re: AI Review Findings**

Fixed:
- <description>

Dismissed:
- <description> — <reason>"
```

### 4e. Re-request Copilot Review (if Copilot threads were processed)

```bash
gh pr edit <PR_NUMBER> --add-reviewer @copilot
```

---

## Step 5 — Iterate (Up to 3 Rounds)

After pushing, wait briefly then fetch unresolved threads again. Repeat Steps 2-4.

Stop when:
- `unresolved_count` is 0, OR
- 3 iterations completed, OR
- No new threads appeared since last round

---

## Step 6 — Final Summary

```
PR #<number> Review Processing Complete

  Rounds completed: <N>

  Review Threads:
  Fixed (<count>):
     - <path>#L<line>: <short description> [source: CodeRabbit/Copilot/Human]
  Dismissed (<count>):
     - <path>#L<line>: <reason> [source: CodeRabbit/Copilot/Human]
  Threads resolved: <count>

  AI Issue Comment Findings:
  Fixed (<count>):
     - <description> [source: Auggie/CodeRabbit]
  Dismissed (<count>):
     - <description> — <reason>

  Commits pushed: <count>
  Remaining unresolved: <count>
```

---

## Error Handling

| Error | Action |
|-------|--------|
| `gh` auth failure | Prompt user to run `gh auth login` |
| Referenced file no longer exists | Auto-dismiss with explanation |
| Tests fail after fix | Revert fix, dismiss thread, continue |
| `git push` fails | Stop and report (may need pull/rebase) |
| GraphQL query fails | Check query syntax, retry once, then report |
| No PR on current branch | Stop — tell user to push and open a PR |

---

## Integration with Builder/Judge Protocol

This skill can be used as a self-review step before marking work `ready_for_judge`:

1. Create or update the PR
2. Wait for AI reviewers to post findings
3. Run `/pr-review` to process all findings
4. Proceed with the builder/judge round

This aligns with the CLAUDE.md requirement: "Run the `code-review` plugin for self-review on all changed files. Address any findings before proceeding."
