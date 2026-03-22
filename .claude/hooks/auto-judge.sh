#!/bin/bash
# Hook: Auto-invoke Codex judge when builder sets state to ready_for_judge
#
# Fires on PostToolUse for Write and Edit tools.
# Checks if the file is a status.json in agent-loop/ and if state is ready_for_judge.
# If so, extracts task_id and round, then runs codex exec in the background.
#
# Override the Codex binary path with CODEX_CLI env var if needed.
# Override the model with CODEX_MODEL env var (default: gpt-5.4).
# Logs to /tmp/codex-judge-<task-id>-round-<N>.log

set -euo pipefail

CODEX_MODEL="${CODEX_MODEL:-gpt-5.4}"

INPUT=$(cat)

# Get the file path from tool input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Exit early if no file path or not a status.json in agent-loop/
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if ! echo "$FILE_PATH" | grep -qE 'agent-loop/[^/]+/status\.json$'; then
  exit 0
fi

# Resolve to absolute path if relative
if [[ "$FILE_PATH" != /* ]]; then
  CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
  if [ -n "$CWD" ]; then
    FILE_PATH="$CWD/$FILE_PATH"
  fi
fi

# Read the actual file to check state
if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

STATE=$(jq -r '.state // empty' "$FILE_PATH")
TASK_ID=$(jq -r '.task_id // empty' "$FILE_PATH")
PHASE=$(jq -r '.phase // empty' "$FILE_PATH")
ROUND=$(jq -r '.round // empty' "$FILE_PATH")

if [ "$STATE" != "ready_for_judge" ] || [ -z "$TASK_ID" ]; then
  exit 0
fi

# Validate TASK_ID format (NNN-kebab-case)
if ! echo "$TASK_ID" | grep -qE '^[0-9]{3}-[a-z0-9-]+$'; then
  echo "WARNING: TASK_ID '$TASK_ID' does not match expected format NNN-kebab-case" >&2
  exit 0
fi

# Prevent double-invocation for the same task+phase+round
MARKER="/tmp/.judge-invoked-${TASK_ID}-${PHASE}-round-${ROUND}"
if [ -f "$MARKER" ]; then
  exit 0
fi
touch "$MARKER"

# Find the Codex CLI binary (bundled with VS Code extension)
CODEX_BIN="${CODEX_CLI:-}"
if [ -z "$CODEX_BIN" ]; then
  CODEX_BIN=$(ls -t ~/.vscode/extensions/openai.chatgpt-*/bin/*/codex 2>/dev/null | head -1)
fi

if [ -z "$CODEX_BIN" ] || [ ! -x "$CODEX_BIN" ]; then
  echo "WARNING: Codex CLI not found. Set CODEX_CLI env var or install the Codex VS Code extension." >&2
  rm -f "$MARKER"
  exit 0
fi

# Determine the repo root (parent of agent-loop/)
REPO_ROOT=$(echo "$FILE_PATH" | sed 's|/agent-loop/.*||')

# Log file for this invocation
LOG_FILE="/tmp/codex-judge-${TASK_ID}-${PHASE}-round-${ROUND}.log"

# --- Immediate feedback to Claude Code ---
CODEX_VERSION=$("$CODEX_BIN" --version 2>/dev/null || echo "unknown")
echo ""
echo "=== AUTO-JUDGE HOOK FIRED ==="
echo "  Task:    $TASK_ID"
echo "  Phase:   $PHASE"
echo "  Round:   $ROUND"
echo "  Model:   $CODEX_MODEL (xhigh reasoning)"
echo "  Codex:   $CODEX_VERSION"
echo "  Log:     $LOG_FILE"
echo "  Monitor: tail -f $LOG_FILE"
echo "============================="
echo ""

# macOS notification: judge dispatched
osascript -e "display notification \"Dispatching judge: $PHASE round $ROUND\" with title \"$TASK_ID\" sound name \"Submarine\"" 2>/dev/null || true

# Launch codex exec fully detached from this process tree.
# Claude Code's hook runner waits for all child processes — a simple `&`
# still blocks because the subshell remains a child. Using nohup + redirects
# + disown ensures the hook exits instantly while Codex runs independently.
WRAPPER="/tmp/.judge-run-${TASK_ID}-${PHASE}-round-${ROUND}.sh"
cat > "$WRAPPER" <<SCRIPT
#!/bin/bash
START_TIME=\$(date +%s)
echo "[\$(date -Iseconds)] Invoking Codex judge for task=$TASK_ID phase=$PHASE round=$ROUND" > "$LOG_FILE"
echo "[dispatch] model=$CODEX_MODEL reasoning=xhigh codex=$CODEX_VERSION" >> "$LOG_FILE"
echo "[dispatch] repo=$REPO_ROOT" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

"$CODEX_BIN" exec \\
  --full-auto \\
  -m $CODEX_MODEL \\
  -c 'model_reasoning_effort="xhigh"' \\
  -C "$REPO_ROOT" \\
  "judge $TASK_ID" \\
  >> "$LOG_FILE" 2>&1

EXIT_CODE=\$?
END_TIME=\$(date +%s)
ELAPSED=\$(( END_TIME - START_TIME ))
ELAPSED_MIN=\$(( ELAPSED / 60 ))
ELAPSED_SEC=\$(( ELAPSED % 60 ))

VERDICT=\$(jq -r '.verdict // "unknown"' "$FILE_PATH" 2>/dev/null || echo "unknown")
NEW_STATE=\$(jq -r '.state // "unknown"' "$FILE_PATH" 2>/dev/null || echo "unknown")
NEW_ROUND=\$(jq -r '.round // "?"' "$FILE_PATH" 2>/dev/null || echo "?")

echo "" >> "$LOG_FILE"
echo "============================================" >> "$LOG_FILE"
echo "[\$(date -Iseconds)] JUDGE COMPLETE" >> "$LOG_FILE"
echo "  Task:     $TASK_ID" >> "$LOG_FILE"
echo "  Phase:    $PHASE" >> "$LOG_FILE"
echo "  Round:    $ROUND" >> "$LOG_FILE"
echo "  Verdict:  \$VERDICT" >> "$LOG_FILE"
echo "  State:    \$NEW_STATE" >> "$LOG_FILE"
echo "  Exit:     \$EXIT_CODE" >> "$LOG_FILE"
echo "  Duration: \${ELAPSED_MIN}m \${ELAPSED_SEC}s" >> "$LOG_FILE"
echo "============================================" >> "$LOG_FILE"

# Count findings if judge.md was updated
JUDGE_FILE="$REPO_ROOT/agent-loop/$TASK_ID/judge.md"
BLOCKERS=""
HIGHS=""
MEDIUMS=""
LOWS=""
if [ -f "\$JUDGE_FILE" ]; then
  BLOCKERS=\$(grep -c '^- B-' "\$JUDGE_FILE" 2>/dev/null || echo "0")
  HIGHS=\$(grep -c '^- H-' "\$JUDGE_FILE" 2>/dev/null || echo "0")
  MEDIUMS=\$(grep -c '^- M-' "\$JUDGE_FILE" 2>/dev/null || echo "0")
  LOWS=\$(grep -c '^- L-' "\$JUDGE_FILE" 2>/dev/null || echo "0")
fi

# macOS notification with verdict and details
if [ "\$VERDICT" = "accepted" ]; then
  SOUND="Glass"
  DETAIL="Phase accepted! (\${ELAPSED_MIN}m \${ELAPSED_SEC}s)"
elif [ "\$VERDICT" = "needs_revision" ]; then
  SOUND="Basso"
  DETAIL="B:\$BLOCKERS H:\$HIGHS M:\$MEDIUMS L:\$LOWS (\${ELAPSED_MIN}m \${ELAPSED_SEC}s)"
elif [ "\$VERDICT" = "escalated" ]; then
  SOUND="Sosumi"
  DETAIL="Escalated to coordinator (\${ELAPSED_MIN}m \${ELAPSED_SEC}s)"
else
  SOUND="Ping"
  DETAIL="exit=\$EXIT_CODE (\${ELAPSED_MIN}m \${ELAPSED_SEC}s)"
fi

osascript -e "display notification \"\$DETAIL\" with title \"Judge: $TASK_ID\" subtitle \"$PHASE r$ROUND → \$VERDICT\" sound name \"\$SOUND\"" 2>/dev/null || true

rm -f "$WRAPPER"
SCRIPT
chmod +x "$WRAPPER"

nohup "$WRAPPER" </dev/null >/dev/null 2>&1 &
disown

exit 0
