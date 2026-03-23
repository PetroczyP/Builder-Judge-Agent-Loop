#!/bin/bash
# Hook: After the /pr-review-toolkit:review-pr skill runs, create a marker
# file so the pre-pr-review hook stops blocking PR creation / git push.
#
# This fires on PostToolUse for the Skill tool. It checks if the skill
# invoked was "pr-review-toolkit:review-pr" or "review-pr".

set -euo pipefail

# Ensure jq is available
if ! command -v jq >/dev/null 2>&1; then
  echo "WARNING: post-pr-review hook skipped — jq is not installed." >&2
  exit 0
fi

INPUT=$(cat)

# Check if this was a Skill tool call for pr-review-toolkit:review-pr
SKILL_NAME=$(echo "$INPUT" | jq -r '.tool_input.skill // empty')

if [ -z "$SKILL_NAME" ]; then
  exit 0
fi

# Match exactly pr-review-toolkit:review-pr or the local pr-review skill
if [ "$SKILL_NAME" = "pr-review-toolkit:review-pr" ] || [ "$SKILL_NAME" = "pr-review" ]; then
  # Get current branch to create the marker
  CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
  if [ -n "$CWD" ]; then
    BRANCH=$(git -C "$CWD" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
  else
    BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
  fi

  if [ -z "$BRANCH" ]; then
    echo "WARNING: post-pr-review hook could not determine current branch. Marker not created." >&2
    exit 0
  fi

  SAFE_BRANCH=$(echo "$BRANCH" | tr '/' '_')
  MARKER="/tmp/.pr-review-done-${SAFE_BRANCH}"
  # Allow 2 uses: one for push, one for PR create (or vice versa)
  echo 2 > "$MARKER"
fi

exit 0
