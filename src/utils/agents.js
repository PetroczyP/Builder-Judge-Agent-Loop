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
  }),
  codex: Object.freeze({
    displayName: 'Codex',
    id: 'codex',
    canBuild: false,
    canJudge: true,
    builderCommandHint: null,
    judgeCommand: 'judge <task-id>',
    judgeInvokeInstruction: 'Send to Codex with `judge <task-id>`',
  }),
});

/**
 * Derive ALL template variables from the full config object.
 * Returns both core vars (coordinator, release mode, max rounds)
 * and agent-specific vars (names, IDs, commands).
 */
export function getTemplateVars(config) {
  const { agentMode, builderAgent, judgeAgent } = config;

  if (!VALID_MODES.has(agentMode)) throw new Error(`Unsupported agent mode: "${agentMode}"`);

  const builder = AGENTS[builderAgent];
  const judge = AGENTS[judgeAgent];
  if (!builder) throw new Error(`Unknown builder agent: "${builderAgent}"`);
  if (!judge) throw new Error(`Unknown judge agent: "${judgeAgent}"`);
  if (!builder.canBuild) throw new Error(`Agent "${builderAgent}" cannot be used as builder`);
  if (!judge.canJudge) throw new Error(`Agent "${judgeAgent}" cannot be used as judge`);

  const judgeName = agentMode === 'single'
    ? `${judge.displayName} (judge mode)`
    : judge.displayName;

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
 */
const VALID_MODES = new Set(['single', 'dual']);

export function getFilesToScaffold(config) {
  const { agentMode } = config;
  if (!VALID_MODES.has(agentMode)) throw new Error(`Unsupported agent mode: "${agentMode}"`);

  const common = [
    { src: 'protocol/PROTOCOL.md', dest: 'agent-loop/PROTOCOL.md' },
    { src: 'protocol/ANTIPATTERNS.md', dest: 'agent-loop/ANTIPATTERNS.md' },
    { src: 'commands/loop.build.md', dest: '.claude/commands/loop.build.md' },
    { src: 'commands/loop.status.md', dest: '.claude/commands/loop.status.md' },
    { src: 'commands/loop.backlog.md', dest: '.claude/commands/loop.backlog.md' },
    { src: 'commands/loop.close.md', dest: '.claude/commands/loop.close.md' },
    { src: 'agents/AGENTS.md', dest: 'AGENTS.md' },
    { src: 'agents/CHEATSHEET.md', dest: 'CHEATSHEET.md' },
    { src: 'task/backlog.md', dest: 'specs/backlog.md' },
  ];

  if (agentMode === 'single') {
    return [
      ...common,
      { src: 'agents/claude-judge.md', dest: '.claude/agents/judge.md' },
      { src: 'commands/loop.review.md', dest: '.claude/commands/loop.review.md' },
    ];
  }

  // dual mode (default)
  return [
    ...common,
    { src: 'agents/CODEX.md', dest: 'CODEX.md' },
  ];
}

/**
 * Return the "next steps" console output lines for the given configuration.
 */
export function getNextSteps(config) {
  if (!VALID_MODES.has(config.agentMode)) throw new Error(`Unsupported agent mode: "${config.agentMode}"`);
  if (config.agentMode === 'single') {
    return [
      '  Next steps:',
      '    1. Review CLAUDE.md and .claude/agents/judge.md',
      '    2. /loop.build new <describe your first task>',
      '    3. When ready for review: /loop.review <task-id>',
    ];
  }

  return [
    '  Next steps:',
    '    1. Review CLAUDE.md and CODEX.md',
    '    2. In Claude Code: /loop.build new <describe your first task>',
    '    3. In Codex: judge <task-id>',
  ];
}
