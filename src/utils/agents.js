/**
 * Agent registry — central data module for agent metadata,
 * template variables, and file mappings.
 */

export const AGENTS = Object.freeze({
  claude: Object.freeze({
    displayName: 'Claude Code',
    id: 'claude',
    canBuild: true,
    canJudge: true,
    builderCommandHint: '/loop.build new <describe task>',
    judgeCommand: '/loop.review <task-id>',
    judgeInvokeInstruction: 'Run `/loop.review <task-id>`',
    judgeTemplate: 'agents/claude-judge.md',
    judgeDestination: '.claude/agents/judge.md',
    needsReviewCommand: true,
  }),
  codex: Object.freeze({
    displayName: 'Codex',
    id: 'codex',
    canBuild: false,
    canJudge: true,
    builderCommandHint: null,
    judgeCommand: 'judge <task-id>',
    judgeInvokeInstruction: 'Send to Codex with `judge <task-id>`',
    judgeTemplate: 'agents/CODEX.md',
    judgeDestination: 'CODEX.md',
    needsReviewCommand: false,
  }),
  copilot: Object.freeze({
    displayName: 'GitHub Copilot',
    id: 'copilot',
    canBuild: false,
    canJudge: true,
    builderCommandHint: null,
    judgeCommand: 'judge <task-id>',
    judgeInvokeInstruction: 'Ask Copilot to review with `judge <task-id>`',
    judgeTemplate: 'agents/copilot-judge.md',
    judgeDestination: '.github/copilot-instructions.md',
    needsReviewCommand: false,
  }),
});

/**
 * Validate a builder/judge agent pair against the registry.
 * Uses Object.hasOwn to avoid prototype chain lookups (e.g., 'constructor').
 * @returns {{ builder: object, judge: object }}
 */
function validateAgentPair(builderAgent, judgeAgent) {
  if (typeof builderAgent !== 'string') {
    throw new Error(`Builder agent must be a string, got ${typeof builderAgent}`);
  }
  if (typeof judgeAgent !== 'string') {
    throw new Error(`Judge agent must be a string, got ${typeof judgeAgent}`);
  }
  if (!Object.hasOwn(AGENTS, builderAgent)) {
    throw new Error(`Unknown builder agent: "${builderAgent}"`);
  }
  const builder = AGENTS[builderAgent];
  if (!builder.canBuild) {
    throw new Error(`Agent "${builderAgent}" cannot be used as builder`);
  }
  if (!Object.hasOwn(AGENTS, judgeAgent)) {
    throw new Error(`Unknown judge agent: "${judgeAgent}"`);
  }
  const judge = AGENTS[judgeAgent];
  if (!judge.canJudge) {
    throw new Error(`Agent "${judgeAgent}" cannot be used as judge`);
  }
  return { builder, judge };
}

/**
 * Derive ALL template variables from the full config object.
 * Returns both core vars (coordinator, release mode, max rounds)
 * and agent-specific vars (names, IDs, commands).
 */
export function getTemplateVars(config) {
  const { builderAgent, judgeAgent } = config;
  const { builder, judge } = validateAgentPair(builderAgent, judgeAgent);

  const judgeName =
    builderAgent === judgeAgent ? `${judge.displayName} (judge mode)` : judge.displayName;

  return {
    // Core vars
    '{{COORDINATOR_NAME}}': config.coordinator ?? '',
    '{{RELEASE_MODE}}': config.releaseMode ?? '',
    '{{MAX_ROUNDS}}': String(config.maxRounds ?? 5),
    // Agent vars
    '{{BUILDER_AGENT_NAME}}': builder.displayName,
    '{{JUDGE_AGENT_NAME}}': judgeName,
    '{{BUILDER_AGENT_ID}}': builder.id,
    '{{JUDGE_AGENT_ID}}': judge.id,
    '{{JUDGE_INVOKE_INSTRUCTION}}': judge.judgeInvokeInstruction,
    '{{JUDGE_COMMAND}}': judge.judgeCommand,
  };
}

/**
 * Return the file list to scaffold for the given agent configuration.
 * Each entry: { src: template path, dest: output path relative to cwd }
 * File selection is driven by the judge agent's registry entry.
 */
export function getFilesToScaffold(config) {
  const { builderAgent, judgeAgent } = config;
  const { judge } = validateAgentPair(builderAgent, judgeAgent);

  const files = [
    { src: 'protocol/PROTOCOL.md', dest: 'agent-loop/PROTOCOL.md' },
    { src: 'protocol/ANTIPATTERNS.md', dest: 'agent-loop/ANTIPATTERNS.md' },
    { src: 'commands/loop.build.md', dest: '.claude/commands/loop.build.md' },
    { src: 'commands/loop.status.md', dest: '.claude/commands/loop.status.md' },
    { src: 'commands/loop.backlog.md', dest: '.claude/commands/loop.backlog.md' },
    { src: 'commands/loop.close.md', dest: '.claude/commands/loop.close.md' },
    { src: 'agents/AGENTS.md', dest: 'AGENTS.md' },
    { src: 'agents/CHEATSHEET.md', dest: 'CHEATSHEET.md' },
    { src: 'task/backlog.md', dest: 'specs/backlog.md' },
    { src: judge.judgeTemplate, dest: judge.judgeDestination },
  ];

  if (judge.needsReviewCommand) {
    files.push({ src: 'commands/loop.review.md', dest: '.claude/commands/loop.review.md' });
  }

  return files;
}

/**
 * Return the "next steps" console output lines for the given configuration.
 * Uses a condensed format when builder and judge are the same agent.
 */
export function getNextSteps(config) {
  const { builderAgent, judgeAgent } = config;
  const { builder, judge } = validateAgentPair(builderAgent, judgeAgent);

  if (builderAgent === judgeAgent) {
    return [
      '  Next steps:',
      `    1. Review CLAUDE.md and ${judge.judgeDestination}`,
      `    2. ${builder.builderCommandHint ?? '(no builder command)'}`,
      `    3. When ready for review: ${judge.judgeCommand}`,
    ];
  }

  return [
    '  Next steps:',
    `    1. Review CLAUDE.md and ${judge.judgeDestination}`,
    `    2. In ${builder.displayName}: ${builder.builderCommandHint ?? '(no builder command)'}`,
    `    3. In ${judge.displayName}: ${judge.judgeCommand}`,
  ];
}

/**
 * Registry of files that have been removed from the managed template set.
 * Used for removed-file detection during upgrade, especially for pre-hash users
 * who have no `managed_files` or `file_hashes` to compare against.
 *
 * When a file is removed from getFilesToScaffold(), add an entry here
 * with the version it was removed in, which judge agents it applied to,
 * and its destination path.
 *
 * @type {ReadonlyArray<{version: string, judgeAgents: string[], dest: string}>}
 */
export const REMOVED_TEMPLATES = Object.freeze([]);
