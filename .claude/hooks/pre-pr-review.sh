#!/bin/bash
# Hook: Block PR creation and pushes to PR branches until /pr-review-toolkit:review-pr has been run.
#
# Intercepts:
#   - gh pr create
#   - git push (when on a non-main/master branch, i.e. likely a PR branch)
#
# How it works:
#   - Reads the tool_input.command from stdin JSON
#   - If it matches a PR-related command, blocks with exit 2 and a message
#     instructing Claude to run the review skill first
#   - A marker file (/tmp/.pr-review-done-<branch>) is created by the
#     companion post-review hook after the skill runs, so the block
#     only fires once per branch per session.

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Exit early if no command (not a Bash tool call with a command)
if [ -z "$COMMAND" ]; then
  exit 0
fi

# Detect PR creation
IS_PR_CREATE=false
if echo "$COMMAND" | grep -qE 'gh\s+pr\s+create'; then
  IS_PR_CREATE=true
fi

# Detect git push (to a non-main branch — likely a PR branch)
IS_GIT_PUSH=false
if echo "$COMMAND" | grep -qE 'git\s+push'; then
  IS_GIT_PUSH=true
fi

# If neither, allow
if [ "$IS_PR_CREATE" = false ] && [ "$IS_GIT_PUSH" = false ]; then
  exit 0
fi

# Check for the current branch to build a marker file path
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
if [ -n "$CWD" ]; then
  BRANCH=$(git -C "$CWD" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
else
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
fi

# For git push: skip if pushing to main/master (not a PR workflow)
if [ "$IS_GIT_PUSH" = true ]; then
  if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
    exit 0
  fi
fi

# Check if review was already done for this branch (marker file exists)
SAFE_BRANCH=$(echo "$BRANCH" | tr '/' '_')
MARKER="/tmp/.pr-review-done-${SAFE_BRANCH}"

if [ -f "$MARKER" ]; then
  # Review was completed — allow both push and PR create, then reset.
  # Decrement the use count; remove marker when exhausted.
  USES=$(cat "$MARKER")
  if [ "$USES" -le 1 ] 2>/dev/null; then
    rm -f "$MARKER"
  else
    echo $(( USES - 1 )) > "$MARKER"
  fi
  exit 0
fi

# Block the action and instruct Claude to run the review skill first
if [ "$IS_PR_CREATE" = true ]; then
  echo "BLOCKED: You must run /pr-review-toolkit:review-pr before creating a PR. After the review completes, retry this command." >&2
else
  echo "BLOCKED: You must run /pr-review-toolkit:review-pr before pushing to PR branch '$BRANCH'. After the review completes, retry this command." >&2
fi
exit 2
