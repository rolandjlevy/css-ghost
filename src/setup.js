import { createInterface } from 'readline';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export const CONFIG_PATH = join(homedir(), '.css-ghost');

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export async function runSetup() {
  console.log(`
👻 css-ghost — AI setup

To enable AI summaries, you need a free OpenRouter API key.

  1. Go to https://openrouter.ai/keys
  2. Sign up (free) and create a key
  3. Paste it below — it will be saved to ${CONFIG_PATH}

`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const key = await new Promise(resolve => {
    rl.question('Paste your OpenRouter API key: ', answer => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (!key) {
    console.log('\n❌ No key entered. Setup cancelled.\n');
    process.exit(1);
  }

  if (!key.startsWith('sk-or-')) {
    console.log('\n⚠️  That doesn\'t look like an OpenRouter key (should start with sk-or-).');
    console.log('   Saving anyway — double-check at https://openrouter.ai/keys if --ai fails.\n');
  }

  const existing = loadConfig();
  saveConfig({ ...existing, openrouterApiKey: key });

  console.log(`
✅ Key saved to ${CONFIG_PATH}

Run css-ghost ./src --ai to get an AI summary alongside your report.
`);
}
