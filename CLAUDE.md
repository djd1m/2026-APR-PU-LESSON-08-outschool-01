# КлассМаркет — маркетплейс онлайн-классов для детей

Российский EdTech-маркетплейс живых онлайн-классов для детей 3-18 лет. Учителя создают и ведут занятия, родители находят и оплачивают подходящие классы для своих детей.

## Архитектура
- Pattern: Distributed Monolith (Monorepo)
- Deploy: Docker Compose на VPS (AdminVPS/HOSTKEY)

## Технологический стек

| Слой | Технология | Назначение |
|------|-----------|------------|
| Frontend | Next.js 14 + TypeScript | SSR/ISR, SEO |
| Backend | NestJS + TypeScript | REST API, WebSocket |
| Database | PostgreSQL 15 | Основное хранилище |
| Cache | Redis 7 | Сессии, кэш, очереди |
| Search | Elasticsearch 8 | Полнотекстовый поиск (< 500ms fulltext, < 200ms filters) |
| Video | Jitsi Meet (self-hosted) | Видеозанятия до 12 участников |
| Payments | ЮKassa v3 | Платежи (54-ФЗ) |
| Files | MinIO | S3-совместимое хранилище |
| AI | MCP Server | Рекомендации классов |
| Queue | BullMQ (Redis) | Фоновые задачи |

## Структура монорепо

```
packages/
├── web/          # Next.js frontend
├── api/          # NestJS backend
├── shared/       # Общие типы и утилиты
├── video/        # Обёртка видеосервиса (Jitsi/LiveKit)
├── ai/           # MCP AI-сервис рекомендаций
└── workers/      # Background jobs (BullMQ)
```

## Параллельное выполнение
- Используй `Task` tool для независимых подзадач
- Тесты, линтинг, type-checking — запускай параллельно
- Для сложных фич — рой специализированных агентов

## Ключевые алгоритмы
1. **AI-рекомендации** — гибрид collaborative + content-based filtering (MCP)
2. **Поисковое ранжирование** — релевантность x рейтинг x свежесть (Elasticsearch)
3. **Платёжный сплит** — автоматический расчёт комиссии 22% и выплата учителю 78%
4. **Геймификация** — XP-система с уровнями, бейджами и streak для детей

## Ключевые бизнес-правила
- Комиссия платформы: 20-25% (средн. 22%) от стоимости занятия
- Учитель устанавливает цену самостоятельно
- Первое занятие бесплатно для новых пользователей
- Возраст учеников: 3-18 лет (436-ФЗ)
- Данные хранятся в РФ (152-ФЗ)
- Max участников в группе: 12

## Feature Lifecycle
- `/plan` — для задач <= 3 файлов
- `/feature` — для задач >= 4 файлов или новой архитектуры
- `/go` — автоматический выбор между /plan и /feature

**НЕ используй `/run all` без контроля** — он может обойти `/feature` pipeline (известный баг, см. insights)

## Доступные команды

| Команда | Назначение |
|---------|-----------|
| /start | Scaffold проекта из docs |
| /feature [name] | Полный цикл фичи (PLAN->VALIDATE->IMPLEMENT->REVIEW) |
| /plan [name] | Лёгкое планирование |
| /go [name] | Автовыбор /plan или /feature |
| /run [mode] | Автономная реализация из roadmap |
| /next | Следующая фича из roadmap |
| /deploy [env] | Деплой |
| /myinsights | Сохранить инсайт |
| /docs | Генерация документации |
| /harvest | Извлечение знаний |

## Доступные агенты

### Pre-shipped (pipeline)
- replicate-coordinator, product-discoverer, doc-validator, harvest-coordinator

### Project-specific
- `planner.md` — планирование фич с алгоритмами из Pseudocode.md
- `code-reviewer.md` — ревью с edge cases из Refinement.md
- `architect.md` — системный дизайн из Architecture.md

## Ключевые риски
1. **Качество учителей** — неконсистентное, нужна система рейтингов и модерация
2. **Chicken-and-egg marketplace** — старт supply-side (учителя), потом demand
3. **152-ФЗ** — data residency в РФ, VPS только российские провайдеры
4. **Видео-инфраструктура** — Jitsi self-hosted требует мощные серверы
5. **Конкуренция с Skyeng/Фоксфорд** — они subscription, мы marketplace

## Post-Agent Insight Capture (ОБЯЗАТЕЛЬНО)
После завершения КАЖДОГО агента (Agent tool completion):
1. Проанализируй результат на наличие неочевидных находок
2. Если есть инсайт (баг, workaround, неожиданное поведение) — добавь в `.claude/insights/index.md`
3. `git add .claude/insights/ && git commit -m "docs(insights): ..." && git push`
4. НЕ откладывай на конец сессии — фиксируй сразу

## Development Insights
См. `.claude/insights/index.md`
