# Agent Insight Capture Rule

## Trigger
После завершения КАЖДОГО Agent tool (получена task-notification с status=completed).

## Action (обязательно)

1. **Прочитай result** агента — ищи:
   - Неожиданное поведение (permission denied, timeout, workaround)
   - Технические решения, которые стоит запомнить
   - Баги или ограничения инструментов
   - Паттерны, которые сработали или не сработали

2. **Если есть инсайт** — немедленно добавь в `.claude/insights/index.md`:
   ```markdown
   ## YYYY-MM-DD — краткое описание

   **Tags:** relevant-tags

   **Problem:** что произошло (1-3 предложения)

   **Solution:** как решили или workaround

   **References:** файлы, ссылки

   ---
   ```

3. **Коммит + push** сразу:
   ```bash
   git add .claude/insights/index.md
   git commit -m "docs(insights): <краткое описание>"
   git push origin HEAD
   ```

## Когда НЕ фиксировать
- Агент просто создал файлы без проблем (рутинная работа)
- Информация уже есть в insights
- Тривиальная ошибка (опечатка, забыл import)

## Почему это важно
Claude Code hooks (`autocommit-insights.cjs`) срабатывают только на Stop сессии.
Если сессия прервётся до Stop — инсайты потеряются. Немедленный коммит после
каждого агента гарантирует сохранность знаний.

## Связанные правила
- `.claude/rules/insights-capture.md` — когда и как фиксировать инсайты
- `.claude/settings.json` — Stop hook `autocommit-insights.cjs` (backup)
