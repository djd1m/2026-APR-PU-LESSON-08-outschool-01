#!/usr/bin/env node

/**
 * autopush.cjs — Auto-push hook for Claude Code
 *
 * ВАЖНО: Должен быть ПОСЛЕДНИМ в массиве Stop hooks в settings.json!
 * Причина: Claude Code выполняет hooks последовательно. Если autopush
 * стоит до autocommit-*, то коммиты insights/roadmap не попадут в push.
 *
 * Инсайт из проекта HopperRU: hook ordering — critical footgun.
 */

const { execSync } = require('child_process');

function main() {
  try {
    // Проверяем, есть ли remote
    const remotes = execSync('git remote', { encoding: 'utf-8' }).trim();
    if (!remotes) {
      console.log('[autopush] No remotes configured, skipping.');
      return;
    }

    // Проверяем, есть ли коммиты для push
    const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    if (!branch) {
      console.log('[autopush] Detached HEAD, skipping.');
      return;
    }

    try {
      const status = execSync(`git status --porcelain`, { encoding: 'utf-8' }).trim();
      // Если есть незакоммиченные изменения, не пушим
      if (status) {
        console.log('[autopush] Uncommitted changes present, skipping push.');
        return;
      }
    } catch (e) {
      // ignore
    }

    // Пушим
    const result = execSync(`git push origin ${branch} 2>&1`, { encoding: 'utf-8' });
    if (result.includes('Everything up-to-date')) {
      console.log('[autopush] Already up-to-date.');
    } else {
      console.log(`[autopush] Pushed ${branch} to origin.`);
    }
  } catch (error) {
    // Не падаем при ошибке (например, нет сети)
    console.log(`[autopush] Push failed (non-fatal): ${error.message}`);
  }
}

main();
