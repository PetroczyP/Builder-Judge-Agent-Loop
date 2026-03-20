import { scaffold } from './cli/scaffold.js';

export async function run(args) {
  const flags = parseFlags(args);
  await scaffold(flags);
}

function parseFlags(args) {
  const flags = { force: false, nonInteractive: false };
  for (const arg of args) {
    if (arg === '--force' || arg === '-f') flags.force = true;
    if (arg === '--yes' || arg === '-y') flags.nonInteractive = true;
  }
  return flags;
}
