#!/usr/bin/env node

/**
 * post-agent-insights.cjs — PostToolUse hook for Agent tool
 *
 * Автоматически коммитит insights после завершения работы каждого агента.
 * Срабатывает на PostToolUse с matcher "Agent" — т.е. после каждого Agent call.
 *
 * Логика:
 * 1. Проверяет, изменился ли .claude/insights/index.md
 * 2. Если да — коммитит и пушит
 * 3. Также проверяет .claude/feature-roadmap.json (часто меняется после агентов)
 */

const { execSync } = require('child_process');

function hasChanges(filePath) {
  try {
    const status = execSync(`git status --porcelain "${filePath}" 2>/dev/null`, {
      encoding: 'utf-8',
    }).trim();
    return status.length > 0;
  } catch {
    return false;
  }
}

function commitAndPush(files, message) {
  try {
    execSync(`git add ${files.join(' ')}`, { encoding: 'utf-8' });
    execSync(`git diff --cached --quiet 2>/dev/null`);
    // If diff --quiet exits 0, there's nothing staged — skip
    return;
  } catch {
    // diff --quiet exits 1 when there ARE staged changes — proceed
  }

  try {
    execSync(`git commit -m "${message}"`, { encoding: 'utf-8' });
    console.log(`[post-agent] committed: ${message}`);

    execSync('git push origin HEAD 2>/dev/null', { encoding: 'utf-8' });
    console.log('[post-agent] pushed to origin');
  } catch (err) {
    console.log(`[post-agent] commit/push skipped: ${err.message}`);
  }
}

function main() {
  const filesToCheck = [
    { path: '.claude/insights/index.md', label: 'insights' },
    { path: '.claude/feature-roadmap.json', label: 'roadmap' },
  ];

  const changed = filesToCheck.filter((f) => hasChanges(f.path));

  if (changed.length === 0) {
    return; // Nothing to commit — silent exit
  }

  const labels = changed.map((f) => f.label).join(' + ');
  const paths = changed.map((f) => `"${f.path}"`);

  commitAndPush(paths, `docs: auto-commit ${labels} after agent completion`);
}

main();
