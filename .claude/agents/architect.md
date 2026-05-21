# Системный архитектор — КлассМаркет

## Роль
Системный архитектор, ответственный за целостность архитектурных решений и соответствие Architecture.md.

## Архитектурные решения (ADR)

### Почему Distributed Monolith, а не Microservices
- Команда 5-10 человек на старте — microservices overhead не оправдан
- Monorepo (packages/*) даёт модульность без сетевых вызовов
- Чётые границы модулей позволят вынести в microservices при масштабировании
- Docker Compose deploy проще, чем K8s

### Почему Jitsi, а не Zoom SDK
- Self-hosted: данные в РФ (152-ФЗ)
- Open-source: нет лицензионных платежей
- Customizable: брендинг, UI, правила комнат
- Fallback: LiveKit как альтернатива для масштабирования

### Почему Elasticsearch, а не Meilisearch
- Russian morphology analyzer из коробки
- Зрелая экосистема, production-proven
- Гибкие scoring-функции для ранжирования
- Масштабируется горизонтально (шарды)

### Почему ЮKassa, а не Stripe
- Stripe не работает с российскими банками (санкции)
- ЮKassa: МИР, СБП, банковские карты, ЮMoney
- Встроенная фискализация (54-ФЗ)
- Split-payments для маркетплейса

## Границы модулей (packages/*)

```
packages/
├── web/              # Next.js 14 (App Router)
│   ├── app/          # Pages и layouts
│   ├── components/   # UI компоненты
│   ├── hooks/        # React hooks
│   └── lib/          # Утилиты, API client
│
├── api/              # NestJS (REST + WebSocket)
│   ├── modules/
│   │   ├── auth/     # AuthModule: VK ID, Яндекс ID, JWT
│   │   ├── users/    # UsersModule: профили, дети
│   │   ├── classes/  # ClassesModule: CRUD, модерация
│   │   ├── enrollments/ # EnrollmentsModule: запись, отмена
│   │   ├── payments/ # PaymentsModule: ЮKassa, сплит, выплаты
│   │   ├── reviews/  # ReviewsModule: отзывы, рейтинги
│   │   ├── video/    # VideoModule: Jitsi rooms
│   │   ├── search/   # SearchModule: Elasticsearch
│   │   ├── notifications/ # NotificationsModule: email, push
│   │   └── admin/    # AdminModule: модерация, аналитика
│   ├── common/       # Guards, filters, interceptors, pipes
│   └── config/       # Env validation (Zod)
│
├── shared/           # Общие типы и утилиты
│   ├── types/        # TypeScript interfaces/enums
│   ├── constants/    # Общие константы
│   └── utils/        # Общие функции
│
├── workers/          # BullMQ background jobs
│   ├── email/        # Email sending
│   ├── notifications/ # Push notifications
│   ├── payments/     # Payout processing
│   └── search/       # Search index sync
│
└── ai/               # MCP AI-сервис
    ├── recommendations/ # Collaborative + content-based
    └── matching/     # Teacher-student matching
```

## Database Design

### PostgreSQL (основное хранилище)
Ключевые таблицы: users, children, teacher_profiles, classes, sections, enrollments, payments, reviews, achievements, notifications
Индексы: classes(subject, age_min, age_max), sections(start_time, status), enrollments(child_id, section_id UNIQUE)

### Redis (кэш + очереди)
- Sessions: `session:{userId}` (TTL 24h)
- Cache: `class:{id}` (TTL 5min), `teacher:{id}` (TTL 10min)
- Rate limit: `ratelimit:{ip}` (sliding window)
- BullMQ queues: email, notifications, payouts, search-sync

### Elasticsearch (поиск)
- Index: `classes` (Russian analyzer, synonyms)
- Fields: title, description, subject, tags, age_range, price, rating, teacher_name
- Sync: через BullMQ worker при изменении класса

## Docker Compose топология
```
web (3000) → api (4000) → postgres (5432)
                        → redis (6379)
                        → elasticsearch (9200)
                        → jitsi (8443, 10000/udp)
                        → minio (9000)
workers → redis (BullMQ)
        → postgres
        → elasticsearch
```

## Стратегия масштабирования

| Фаза | Нагрузка | Инфраструктура |
|------|----------|---------------|
| MVP (M1-6) | < 1K concurrent | 1 VPS (8 CPU, 32GB RAM) |
| Scale (M6-12) | 1-10K concurrent | 2 VPS + PostgreSQL read replica + CDN |
| Growth (M12+) | 10K+ concurrent | 3+ VPS, отдельные серверы для Jitsi, Elasticsearch cluster |

## Когда разделять модули
- Модуль > 20 файлов → рассмотреть вынос в отдельный package
- Модуль имеет независимый deploy cycle → microservice candidate
- Видео и AI — первые кандидаты на вынос (ресурсоёмкие)
