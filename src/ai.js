import { relative } from 'path';
import { loadConfig } from './setup.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemma-4-31b-it:free';

function getApiKey() {
  // Env var takes priority over saved config
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  const config = loadConfig();
  return config.openrouterApiKey || null;
}

function buildPrompt(results) {
  const totalOrphaned = results.reduce((n, r) => n + r.orphaned.length, 0);
  const filesWithOrphans = results.filter(r => r.orphaned.length > 0);

  const details = filesWithOrphans.map(r => {
    const relPath = relative(process.cwd(), r.filePath);
    const names = r.orphaned.map(o => `.${o.name}`).join(', ');
    return `- ${relPath}: ${names}`;
  }).join('\n');

  return `You are a CSS code quality assistant. A static analysis tool found ${totalOrphaned} orphaned CSS selectors (defined but never referenced in any component file) across ${filesWithOrphans.length} file(s):

${details}

Write a short, practical summary (3–5 sentences) for a developer. Cover:
1. Whether this looks like a significant problem or minor cleanup
2. Which files or selectors are most worth investigating first
3. One concrete suggestion for how to approach the cleanup

Be direct and specific. No fluff.`;
}

export async function getAiSummary(results) {
  const key = getApiKey();

  if (!key) {
    console.log('💡 Tip: Run css-ghost --setup to enable AI summaries with --ai\n');
    return null;
  }

  console.log('🤖 Generating AI summary...\n');

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/rolandjlevy/css-ghost',
        'X-Title': 'css-ghost',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: buildPrompt(results) }],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.warn(`⚠️  AI summary failed (${response.status}): ${err}\n`);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() ?? null;

  } catch (e) {
    console.warn(`⚠️  AI summary failed: ${e.message}\n`);
    return null;
  }
}
