# 5. Архитектура

## 5.1. Distributed Monolith

КлассМаркет использует паттерн **Distributed Monolith**. Все модули живут в едином монорепозитории (`packages/*`) и делят типы через пакет `shared`. Каждый пакет деплоится как отдельный Docker-контейнер, что позволяет масштабировать компоненты независимо, сохраняя простоту монолита.

### Принципы

1. **Монорепо с чёткими границами** -- у каждого пакета свой `package.json`; общие типы и утилиты вынесены в `shared`.
2. **API-first** -- всё взаимодействие через REST API с OpenAPI-спецификацией.
3. **Infrastructure as Code** -- вся инфраструктура описана в `docker-compose.yml`.
4. **Безопасность по умолчанию** -- соответствие 152-ФЗ, шифрование, RBAC на каждом уровне.
5. **Наблюдаемость** -- логи, метрики и трейсинг для каждого компонента.

---

## 5.2. Структура монорепозитория

```
klassmarket/
  packages/
    web/              # Next.js 14 (App Router, SSR/ISR)
      src/
        app/          # Маршруты: (auth), (main), (admin), (video)
        components/   # UI-компоненты, классы, видео, геймификация
        hooks/        # React-хуки
        store/        # Zustand (управление состоянием)
        lib/          # API-клиент, утилиты

    api/              # NestJS (REST + WebSocket)
      src/
        common/       # Guards, decorators, interceptors, filters, pipes
        modules/      # Auth, Users, Children, Teachers, Classes, Sections,
                      # Enrollments, Payments, Reviews, Achievements,
                      # Notifications, Search, Recommendations, Admin, Media
        database/     # Миграции, сиды, сущности
        config/       # Конфигурация окружения

    shared/           # Общие TypeScript-типы и утилиты
      src/
        types/        # User, Class, Enrollment, Payment и др.
        constants/    # Enum-ы, коды ошибок
        validators/   # Zod / class-validator схемы

    video/            # Сервис видеозвонков
      src/
        jitsi/        # Обёртка Jitsi Meet API
        livekit/      # Обёртка LiveKit API (альтернатива)

    ai/               # MCP AI-сервис
      src/
        mcp-server.ts              # Model Context Protocol сервер
        recommendations/           # Коллаборативная, контентная, гибридная фильтрация

    workers/          # Фоновые задачи (BullMQ)
      src/
        queues/       # email, notification, payment, search-index, gamification
        processors/   # Обработчики очередей

  docker/
    nginx/            # Конфигурация обратного прокси
    jitsi/            # Конфигурация Jitsi Meet
    postgres/         # Скрипты инициализации БД
    elasticsearch/    # Конфигурация ES

  docker-compose.yml / .dev.yml / .prod.yml
  Dockerfile          # Multi-stage сборка
  turbo.json          # Turborepo
```

---

## 5.3. Технологический стек

| Компонент | Технология | Версия | Назначение |
|-----------|-----------|--------|-----------|
| Фронтенд | Next.js (React) | 14.x | SSR/SSG, App Router, Server Components |
| Стилизация | Tailwind CSS + shadcn/ui | 3.x | Быстрая разработка UI |
| Состояние | Zustand | 4.x | Лёгкое клиентское состояние |
| Бэкенд | NestJS | 10.x | Модульная архитектура, DI, OpenAPI |
| Язык | TypeScript | 5.x | Сквозная типобезопасность |
| ORM | TypeORM | 0.3.x | Миграции, декораторы, PostgreSQL |
| Валидация | class-validator + class-transformer | -- | Декларативная валидация DTO |
| БД | PostgreSQL | 15.x | Реляционное хранилище, JSON, расширения |
| Кэш / Очереди | Redis + BullMQ | 7.x / 4.x | In-memory, pub/sub, надёжная доставка задач |
| Поиск | Elasticsearch | 8.x | Полнотекстовый поиск с русской морфологией |
| Видео | Jitsi Meet (self-hosted) | latest | WebRTC, запись, модерация |
| Файлы | MinIO | latest | S3-совместимое хранилище (152-ФЗ) |
| Платежи | ЮKassa | API v3 | Карты, СБП, YooMoney, 54-ФЗ |
| Аутентификация | Passport.js + JWT | -- | VK ID, Yandex ID, email+пароль, JWT RS256 |
| AI/ML | MCP Server | -- | AI-рекомендации классов |
| Прокси | Nginx | 1.25.x | SSL, rate limiting, WebSocket |
| Контейнеры | Docker + Docker Compose | 24.x / 2.x | Изоляция сервисов |
| Монорепо | Turborepo | 1.x | Параллельные сборки, кэширование |
| CI/CD | GitHub Actions | -- | Тесты, линтинг, сборка, деплой |
| Мониторинг | Prometheus + Grafana | -- | Метрики, дашборды, алерты |
| Логирование | Winston + Loki | -- | Структурированные JSON-логи |
| Инфраструктура | VPS (AdminVPS / HOSTKEY) | -- | Российские ЦОДы для 152-ФЗ |

---

## 5.4. Docker-топология

```
                    Интернет
                       |
                    [Nginx]
                   /   |   \
                  /    |    \
           [Next.js] [NestJS] [Jitsi]
                       |
              +--------+--------+
              |        |        |
         [PostgreSQL] [Redis] [Elasticsearch]
              |                    |
           [MinIO]            [BullMQ Workers]
                                   |
                              [MCP AI Server]
```

Все сервисы запускаются как Docker-контейнеры, оркестрируемые Docker Compose. В продакшене Nginx отвечает за SSL-терминацию, rate limiting и балансировку нагрузки.

---

## 5.5. Схема базы данных

### Основные таблицы

| Таблица | Описание | Ключевые поля |
|---------|----------|---------------|
| `users` | Аккаунты пользователей | id, email, phone, password_hash, role (PARENT/TEACHER/ADMIN) |
| `children` | Профили детей | id, parent_id, first_name, birth_date, interests[], xp, level, streak_days |
| `teacher_profiles` | Данные учителей | id, user_id, status, bio, specializations[], rating, balance_kopecks |
| `categories` | Категории (иерархия) | id, slug, name, parent_id, sort_order |
| `classes` | Объявления классов | id, teacher_id, title, slug, category_id, age_min/max, price_kopecks, status |
| `sections` | Запланированные занятия | id, class_id, start_time, end_time, timezone, max_students, is_trial |
| `enrollments` | Записи детей на занятия | id, child_id, section_id, parent_id, payment_id, status |
| `payments` | Платежи | id, external_id, amount_kopecks, commission_kopecks, status |
| `reviews` | Отзывы родителей | id, class_id, parent_id, rating, text_content, status |
| `achievements` | Определения бейджей | id, slug, name, condition (JSON), xp_reward |
| `child_achievements` | Полученные бейджи | id, child_id, achievement_id, earned_at |
| `notifications` | Уведомления | id, user_id, type, title, body, is_read |

### Связи

```
users 1--* children
users 1--? teacher_profiles
teacher_profiles 1--* classes
classes *--1 categories (categories -- self-referencing)
classes 1--* sections
sections 1--* enrollments
children 1--* enrollments
enrollments ?--1 payments
classes 1--* reviews
children 1--* child_achievements
```

### Денежные значения

Все суммы хранятся как `bigint` в **копейках** для исключения ошибок округления. Разделение комиссии: платформа 20-25% (в среднем 22%), учитель 75-80% (в среднем 78%).

---

## 5.6. Безопасность

### Аутентификация

- **Методы**: VK ID OAuth2, Yandex ID OAuth2, email + пароль (bcrypt, cost factor 12).
- **Токены**: JWT RS256. Access token TTL: 15 минут. Refresh token TTL: 30 дней (хранится в Redis, ротируется при использовании).

### RBAC (управление доступом на основе ролей)

Три роли: `PARENT`, `TEACHER`, `ADMIN`. Контроль через NestJS-гарды (`AuthGuard` + `RolesGuard`) на каждом защищённом эндпоинте.

### Шифрование данных

| Уровень | Технология |
|---------|-----------|
| В транзите | TLS 1.3 через Nginx |
| В покое (БД) | pgcrypto для чувствительных полей |
| В покое (файлы) | MinIO SSE-S3 |
| Пароли | bcrypt (cost factor 12) |
| Токены | JWT RS256 (асимметричный) |

### Соответствие законодательству

| Закон | Требование | Реализация |
|-------|-----------|------------|
| **152-ФЗ** | Хранение ПДн в РФ | VPS в московских ЦОДах (AdminVPS/HOSTKEY) |
| **152-ФЗ** | Согласие на обработку | Явный чекбокс при регистрации |
| **152-ФЗ** | Право на доступ/удаление | `GET /users/me/data-export`, `DELETE /users/me` |
| **54-ФЗ** | Фискальные чеки | ЮKassa генерирует чеки |
| **436-ФЗ** | Маркировка контента | `ageMin`/`ageMax` на каждом классе (0+, 6+, 12+, 16+) |
| **436-ФЗ** | Модерация контента | Все классы проверяются админом перед публикацией |
| **436-ФЗ** | Родительский контроль | Дети -- только через аккаунт родителя |
