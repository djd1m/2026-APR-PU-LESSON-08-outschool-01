# C4 Architecture Diagrams: Маркетплейс онлайн-классов для детей (Outschool RU)

## C1: Системный контекст (System Context)

Диаграмма верхнего уровня показывает платформу и её взаимодействие с пользователями и внешними системами.

```mermaid
graph TB
    subgraph Пользователи
        Parent["Родитель<br/><i>Ищет и бронирует<br/>онлайн-классы для детей</i>"]
        Teacher["Преподаватель<br/><i>Создаёт и проводит<br/>онлайн-занятия</i>"]
        Child["Ребёнок (3-18 лет)<br/><i>Посещает занятия<br/>через браузер родителя</i>"]
        Admin["Администратор<br/><i>Модерирует контент,<br/>управляет платформой</i>"]
    end

    Platform["<b>Outschool RU</b><br/>Маркетплейс онлайн-классов<br/><i>Поиск, бронирование, проведение<br/>и оплата живых занятий для детей</i>"]

    subgraph Внешние системы
        YuKassa["ЮKassa<br/><i>Приём платежей,<br/>выплаты учителям</i>"]
        VKID["VK ID<br/><i>OAuth-аутентификация</i>"]
        YandexID["Яндекс ID<br/><i>OAuth-аутентификация</i>"]
        Jitsi["Jitsi Meet<br/>(self-hosted)<br/><i>Видеоконференции</i>"]
        EmailSMTP["Email-сервис<br/>(SMTP)<br/><i>Отправка уведомлений</i>"]
        SMSGateway["SMS-шлюз<br/><i>SMS-уведомления<br/>и подтверждения</i>"]
    end

    Parent -->|"Поиск классов,<br/>бронирование, оплата"| Platform
    Teacher -->|"Создание классов,<br/>проведение занятий"| Platform
    Child -->|"Посещение<br/>видеозанятий"| Platform
    Admin -->|"Модерация,<br/>управление"| Platform

    Platform -->|"Приём платежей,<br/>возвраты, выплаты"| YuKassa
    Platform -->|"OAuth 2.0"| VKID
    Platform -->|"OAuth 2.0"| YandexID
    Platform -->|"JWT-авторизация,<br/>видеокомнаты"| Jitsi
    Platform -->|"Транзакционные<br/>письма"| EmailSMTP
    Platform -->|"SMS-коды,<br/>уведомления"| SMSGateway

    style Platform fill:#2563eb,stroke:#1d4ed8,color:#fff
    style YuKassa fill:#f59e0b,stroke:#d97706,color:#000
    style Jitsi fill:#10b981,stroke:#059669,color:#fff
    style VKID fill:#4c75a3,stroke:#3b5998,color:#fff
    style YandexID fill:#fc3f1d,stroke:#e33512,color:#fff
```

---

## C2: Диаграмма контейнеров (Container Diagram)

Показывает внутреннюю структуру платформы: основные контейнеры (приложения/сервисы) и их взаимодействие.

```mermaid
graph TB
    subgraph Пользователи
        Browser["Браузер<br/>(Chrome, Firefox, Safari)"]
        AdminBrowser["Браузер<br/>администратора"]
    end

    subgraph "Outschool RU Platform"
        subgraph "Фронтенд"
            WebApp["<b>Web Application</b><br/>Next.js 14 (App Router)<br/>TypeScript + Tailwind CSS<br/><br/><i>SSR/ISR, каталог классов,<br/>личные кабинеты,<br/>страницы оплаты</i><br/><br/>Порт: 3000"]
        end

        subgraph "Бэкенд"
            API["<b>API Server</b><br/>NestJS + TypeScript<br/>Prisma ORM<br/><br/><i>REST API, бизнес-логика,<br/>аутентификация, платежи,<br/>webhook-обработка</i><br/><br/>Порт: 3001"]

            Worker["<b>Background Worker</b><br/>Bull + NestJS<br/><br/><i>Очереди: email-рассылка,<br/>выплаты учителям,<br/>индексация поиска,<br/>обработка видеозаписей</i>"]
        end

        subgraph "Хранилища данных"
            PostgreSQL["<b>PostgreSQL 16</b><br/><br/><i>Основная БД: пользователи,<br/>классы, записи, платежи,<br/>отзывы, расписание</i><br/><br/>Порт: 5432"]

            Redis["<b>Redis 7</b><br/><br/><i>Кэш (API, сессии),<br/>очереди Bull,<br/>rate limiting,<br/>real-time счётчики</i><br/><br/>Порт: 6379"]

            Elasticsearch["<b>Elasticsearch 8</b><br/><br/><i>Полнотекстовый поиск,<br/>фильтрация классов,<br/>русскоязычный анализатор</i><br/><br/>Порт: 9200"]

            FileStorage["<b>File Storage</b><br/>S3-compatible (MinIO)<br/><br/><i>Аватары, материалы<br/>занятий, документы<br/>учителей</i><br/><br/>Порт: 9000"]
        end

        subgraph "Видеосервис"
            JitsiStack["<b>Jitsi Meet Stack</b><br/>Web + Prosody + Jicofo + JVB<br/><br/><i>Видеоконференции,<br/>модерация, запись (Jibri),<br/>screen sharing</i><br/><br/>Порты: 8443, 10000/UDP"]
        end

        subgraph "Мониторинг"
            Prometheus["<b>Prometheus</b><br/><i>Метрики</i>"]
            Grafana["<b>Grafana</b><br/><i>Дашборды, алерты</i>"]
            Loki["<b>Loki</b><br/><i>Агрегация логов</i>"]
        end

        Nginx["<b>Nginx</b><br/>Reverse Proxy<br/>SSL Termination<br/><br/>Порты: 80, 443"]
    end

    subgraph "Внешние системы"
        YuKassa["ЮKassa API"]
        OAuth["VK ID / Яндекс ID"]
        SMTP["SMTP-сервер"]
    end

    Browser -->|"HTTPS"| Nginx
    AdminBrowser -->|"HTTPS"| Nginx
    Nginx -->|"HTTP"| WebApp
    Nginx -->|"HTTP"| API
    Nginx -->|"WebSocket"| JitsiStack

    WebApp -->|"REST API<br/>JSON"| API

    API -->|"Prisma<br/>SQL"| PostgreSQL
    API -->|"ioredis<br/>Cache/Pub-Sub"| Redis
    API -->|"@elastic/elasticsearch<br/>Search"| Elasticsearch
    API -->|"S3 SDK<br/>Upload/Download"| FileStorage
    API -->|"JWT tokens<br/>Room management"| JitsiStack
    API -->|"Bull<br/>Job dispatch"| Worker

    Worker -->|"Prisma<br/>SQL"| PostgreSQL
    Worker -->|"ioredis<br/>Queue"| Redis
    Worker -->|"HTTP"| SMTP
    Worker -->|"@elastic/elasticsearch<br/>Index"| Elasticsearch

    API -->|"HTTPS<br/>Payments API"| YuKassa
    API -->|"OAuth 2.0"| OAuth
    YuKassa -->|"Webhook<br/>HTTPS POST"| API

    Prometheus -->|"Scrape"| API
    Prometheus -->|"Scrape"| PostgreSQL
    Prometheus -->|"Scrape"| Redis
    Grafana -->|"Query"| Prometheus
    Grafana -->|"Query"| Loki

    style WebApp fill:#3b82f6,stroke:#2563eb,color:#fff
    style API fill:#8b5cf6,stroke:#7c3aed,color:#fff
    style Worker fill:#6366f1,stroke:#4f46e5,color:#fff
    style PostgreSQL fill:#336791,stroke:#264d73,color:#fff
    style Redis fill:#dc382d,stroke:#b92e24,color:#fff
    style Elasticsearch fill:#fed10a,stroke:#dbb609,color:#000
    style JitsiStack fill:#10b981,stroke:#059669,color:#fff
    style Nginx fill:#009639,stroke:#007530,color:#fff
```

---

## C3: Диаграмма компонентов API-сервера (Component Diagram)

Детализация внутренних модулей NestJS API-сервера.

```mermaid
graph TB
    subgraph "API Server (NestJS)"
        subgraph "Middleware Layer"
            AuthGuard["<b>Auth Guard</b><br/><i>JWT-верификация,<br/>извлечение пользователя</i>"]
            RoleGuard["<b>Role Guard</b><br/><i>RBAC: parent, teacher,<br/>admin, superadmin</i>"]
            RateLimiter["<b>Rate Limiter</b><br/><i>Throttler + Redis store,<br/>per IP/user/endpoint</i>"]
            ValidationPipe["<b>Validation Pipe</b><br/><i>Zod-схемы,<br/>санитизация входа</i>"]
            LoggerMiddleware["<b>Logger</b><br/><i>Structured JSON logs,<br/>trace ID propagation</i>"]
        end

        subgraph "Модуль аутентификации (AuthModule)"
            AuthController["<b>AuthController</b><br/><i>POST /auth/register<br/>POST /auth/login<br/>POST /auth/refresh<br/>POST /auth/logout<br/>GET /auth/vk/callback<br/>GET /auth/yandex/callback</i>"]
            AuthService["<b>AuthService</b><br/><i>JWT генерация/валидация,<br/>хеширование паролей (bcrypt),<br/>refresh-токен ротация</i>"]
            OAuthService["<b>OAuthService</b><br/><i>VK ID, Яндекс ID<br/>callback обработка,<br/>связывание аккаунтов</i>"]
        end

        subgraph "Модуль классов (ClassesModule)"
            ClassesController["<b>ClassesController</b><br/><i>CRUD /classes,<br/>GET /classes/search,<br/>GET /classes/:id/schedule</i>"]
            ClassesService["<b>ClassesService</b><br/><i>Создание/редактирование,<br/>публикация, архивирование,<br/>управление расписанием</i>"]
            SearchService["<b>SearchService</b><br/><i>Elasticsearch индексация,<br/>полнотекстовый поиск,<br/>фильтрация, ранжирование</i>"]
        end

        subgraph "Модуль записей (EnrollmentsModule)"
            EnrollmentsController["<b>EnrollmentsController</b><br/><i>POST /enrollments,<br/>DELETE /enrollments/:id,<br/>GET /enrollments/my</i>"]
            EnrollmentsService["<b>EnrollmentsService</b><br/><i>Бронирование места,<br/>конкурентный контроль,<br/>waitlist, отмена</i>"]
            ScheduleService["<b>ScheduleService</b><br/><i>Проверка конфликтов,<br/>часовые пояса,<br/>повторяющиеся события</i>"]
        end

        subgraph "Модуль платежей (PaymentsModule)"
            PaymentsController["<b>PaymentsController</b><br/><i>POST /payments,<br/>POST /payments/webhook,<br/>POST /payments/refund</i>"]
            PaymentsService["<b>PaymentsService</b><br/><i>Создание платежа ЮKassa,<br/>идемпотентность,<br/>подтверждение/отмена</i>"]
            PayoutsService["<b>PayoutsService</b><br/><i>Расчёт выплат учителям,<br/>комиссия платформы,<br/>ЮKassa Payouts API</i>"]
            WebhookHandler["<b>WebhookHandler</b><br/><i>Верификация подписи,<br/>обработка событий:<br/>succeeded, canceled,<br/>refund.succeeded</i>"]
        end

        subgraph "Модуль отзывов (ReviewsModule)"
            ReviewsController["<b>ReviewsController</b><br/><i>POST /reviews,<br/>GET /reviews/class/:id,<br/>GET /reviews/teacher/:id</i>"]
            ReviewsService["<b>ReviewsService</b><br/><i>Создание отзыва,<br/>расчёт рейтинга,<br/>модерация контента</i>"]
        end

        subgraph "Модуль уведомлений (NotificationsModule)"
            NotificationsService["<b>NotificationsService</b><br/><i>Оркестрация каналов:<br/>email, push, in-app</i>"]
            EmailService["<b>EmailService</b><br/><i>Шаблоны (Handlebars),<br/>SMTP-отправка,<br/>retry-логика</i>"]
            PushService["<b>PushService</b><br/><i>Web Push API,<br/>VAPID-ключи</i>"]
        end

        subgraph "Модуль видео (VideoModule)"
            VideoController["<b>VideoController</b><br/><i>POST /video/room,<br/>GET /video/token,<br/>POST /video/recording</i>"]
            VideoService["<b>VideoService</b><br/><i>Создание комнат Jitsi,<br/>JWT-токены участников,<br/>управление записью</i>"]
        end

        subgraph "AI-модуль (AIModule)"
            AIService["<b>AIService</b><br/><i>Рекомендации классов,<br/>модерация контента,<br/>персонализация поиска</i>"]
        end

        subgraph "Админ-модуль (AdminModule)"
            AdminController["<b>AdminController</b><br/><i>GET /admin/dashboard,<br/>PUT /admin/classes/:id/moderate,<br/>PUT /admin/teachers/:id/verify,<br/>GET /admin/payments/report</i>"]
            AdminService["<b>AdminService</b><br/><i>Модерация, верификация,<br/>статистика, отчёты,<br/>управление пользователями</i>"]
        end

        subgraph "Общие сервисы"
            PrismaService["<b>PrismaService</b><br/><i>ORM, транзакции,<br/>middleware (soft-delete,<br/>audit log)</i>"]
            CacheService["<b>CacheService</b><br/><i>Redis cache-aside,<br/>инвалидация,<br/>TTL-управление</i>"]
            FileService["<b>FileService</b><br/><i>S3 upload/download,<br/>генерация presigned URL,<br/>валидация файлов</i>"]
            AuditService["<b>AuditService</b><br/><i>Логирование действий,<br/>запись в audit_logs</i>"]
        end
    end

    subgraph "Внешние зависимости"
        DB[(PostgreSQL)]
        Cache[(Redis)]
        Search[(Elasticsearch)]
        Storage[(S3/MinIO)]
        YK[ЮKassa API]
        VK[VK ID]
        YA[Яндекс ID]
        JitsiAPI[Jitsi API]
        SMTPServer[SMTP]
    end

    %% Middleware flow
    AuthGuard --> AuthService
    RateLimiter --> Cache

    %% Auth connections
    AuthService --> PrismaService
    AuthService --> CacheService
    OAuthService --> VK
    OAuthService --> YA

    %% Classes connections
    ClassesService --> PrismaService
    ClassesService --> SearchService
    ClassesService --> CacheService
    SearchService --> Search

    %% Enrollments connections
    EnrollmentsService --> PrismaService
    EnrollmentsService --> PaymentsService
    EnrollmentsService --> NotificationsService
    EnrollmentsService --> CacheService
    ScheduleService --> PrismaService

    %% Payments connections
    PaymentsService --> YK
    PaymentsService --> PrismaService
    PayoutsService --> YK
    PayoutsService --> PrismaService
    WebhookHandler --> PaymentsService
    WebhookHandler --> EnrollmentsService
    WebhookHandler --> NotificationsService

    %% Reviews connections
    ReviewsService --> PrismaService
    ReviewsService --> AIService

    %% Notifications connections
    EmailService --> SMTPServer
    NotificationsService --> EmailService
    NotificationsService --> PushService

    %% Video connections
    VideoService --> JitsiAPI
    VideoService --> PrismaService

    %% AI connections
    AIService --> Search
    AIService --> PrismaService

    %% Admin connections
    AdminService --> PrismaService
    AdminService --> CacheService

    %% Common services
    PrismaService --> DB
    CacheService --> Cache
    FileService --> Storage
    AuditService --> PrismaService

    style AuthController fill:#ef4444,stroke:#dc2626,color:#fff
    style ClassesController fill:#3b82f6,stroke:#2563eb,color:#fff
    style EnrollmentsController fill:#10b981,stroke:#059669,color:#fff
    style PaymentsController fill:#f59e0b,stroke:#d97706,color:#000
    style ReviewsController fill:#8b5cf6,stroke:#7c3aed,color:#fff
    style VideoController fill:#06b6d4,stroke:#0891b2,color:#fff
    style AdminController fill:#6b7280,stroke:#4b5563,color:#fff
```

---

## C4: Диаграммы кода — ключевые потоки (Code Diagrams)

### 4.1 Поток записи на занятие (Enrollment Flow)

```mermaid
sequenceDiagram
    autonumber
    participant P as Родитель (Браузер)
    participant W as Web App (Next.js)
    participant A as API (NestJS)
    participant DB as PostgreSQL
    participant R as Redis
    participant YK as ЮKassa
    participant N as Notification Worker
    participant E as Email Service

    P->>W: Нажимает "Записаться"
    W->>A: POST /api/enrollments<br/>{classId, childId, sessionIds}

    Note over A: Auth Guard: проверка JWT
    Note over A: Validation Pipe: Zod-валидация

    A->>R: GET class:{classId}:seats
    R-->>A: remainingSeats: 3

    alt remainingSeats > 0
        A->>DB: BEGIN TRANSACTION
        A->>DB: SELECT ... FROM classes<br/>WHERE id = classId<br/>FOR UPDATE
        DB-->>A: class (с блокировкой строки)

        A->>DB: SELECT COUNT(*) FROM enrollments<br/>WHERE class_id = classId<br/>AND status = 'active'
        DB-->>A: currentEnrollments: 7

        alt currentEnrollments < maxStudents
            A->>DB: INSERT INTO enrollments<br/>(class_id, child_id, status='pending_payment')
            DB-->>A: enrollment created

            A->>DB: INSERT INTO payments<br/>(enrollment_id, amount, status='pending',<br/>idempotency_key=UUID)
            DB-->>A: payment created

            A->>YK: POST /payments<br/>{amount, description,<br/>confirmation: {type: 'redirect'},<br/>metadata: {enrollmentId}}
            YK-->>A: {id, confirmation_url, status: 'pending'}

            A->>DB: UPDATE payments SET<br/>external_id = yukassa_id
            A->>DB: COMMIT

            A->>R: DECR class:{classId}:seats
            A-->>W: 200 {confirmationUrl}
            W-->>P: Редирект на страницу оплаты ЮKassa
        else Мест нет
            A->>DB: ROLLBACK
            A-->>W: 409 {message: "Нет свободных мест"}
            W-->>P: "Мест нет. Встать в лист ожидания?"
        end
    else remainingSeats = 0 (из кэша)
        A-->>W: 409 {message: "Нет свободных мест"}
    end

    Note over P,YK: Родитель оплачивает на странице ЮKassa

    YK->>A: POST /api/payments/webhook<br/>{event: 'payment.succeeded',<br/>object: {id, metadata}}

    Note over A: Верификация подписи webhook

    A->>DB: UPDATE payments SET status='succeeded'<br/>WHERE external_id = yukassa_id
    A->>DB: UPDATE enrollments SET status='active'<br/>WHERE id = enrollmentId

    A->>R: Publish 'enrollment.confirmed'<br/>{enrollmentId, parentId, classId}

    A-->>YK: 200 OK

    R->>N: Job: send enrollment confirmation
    N->>DB: SELECT enrollment + class + teacher details
    N->>E: Send email: "Вы записаны на занятие!"
    E-->>P: Email с подтверждением и деталями
```

### 4.2 Поток обработки платежа (Payment Flow)

```mermaid
sequenceDiagram
    autonumber
    participant P as Родитель
    participant A as API (NestJS)
    participant DB as PostgreSQL
    participant R as Redis
    participant YK as ЮKassa
    participant Q as Bull Queue
    participant W as Worker

    Note over P,W: === СОЗДАНИЕ ПЛАТЕЖА ===

    P->>A: POST /api/payments<br/>{enrollmentId, method: 'bank_card'}

    Note over A: Генерация idempotency_key (UUID v4)

    A->>DB: SELECT enrollment WHERE id = enrollmentId
    DB-->>A: enrollment (status: 'pending_payment')

    A->>DB: SELECT payment WHERE<br/>enrollment_id = enrollmentId<br/>AND status IN ('pending', 'succeeded')

    alt Платёж уже существует
        A-->>P: 200 {existingPayment}
    else Новый платёж
        A->>DB: INSERT INTO payments (amount, status='created',<br/>idempotency_key, method)

        A->>YK: POST /v3/payments<br/>Idempotence-Key: {key}<br/>{amount: {value, currency: 'RUB'},<br/>payment_method_data: {type: 'bank_card'},<br/>confirmation: {type: 'redirect',<br/>return_url: 'https://...'},<br/>capture: true,<br/>metadata: {paymentId, enrollmentId}}

        alt ЮKassa OK
            YK-->>A: {id: 'yk_xxx', status: 'pending',<br/>confirmation: {confirmation_url: '...'}}
            A->>DB: UPDATE payments SET<br/>external_id='yk_xxx', status='pending'
            A-->>P: 200 {confirmationUrl}
        else ЮKassa Error
            YK-->>A: 4xx/5xx error
            A->>DB: UPDATE payments SET status='failed'
            A-->>P: 502 {message: "Ошибка платёжной системы"}
        end
    end

    Note over P,W: === WEBHOOK: УСПЕШНЫЙ ПЛАТЁЖ ===

    YK->>A: POST /api/payments/webhook<br/>Content-Type: application/json<br/>{event: 'payment.succeeded',<br/>object: {id: 'yk_xxx', status: 'succeeded',<br/>amount: {value: '1500.00'},<br/>metadata: {paymentId, enrollmentId}}}

    Note over A: 1. Проверка IP ЮKassa (whitelist)<br/>2. Верификация подписи HMAC-SHA256<br/>3. Проверка idempotency (дедупликация)

    A->>DB: BEGIN TRANSACTION

    A->>DB: SELECT payment WHERE external_id = 'yk_xxx'<br/>FOR UPDATE
    DB-->>A: payment (status: 'pending')

    alt Платёж ещё не обработан
        A->>DB: UPDATE payments SET<br/>status='succeeded',<br/>paid_at=NOW()

        A->>DB: UPDATE enrollments SET<br/>status='active'<br/>WHERE id = enrollmentId

        A->>DB: INSERT INTO transactions<br/>(type: 'payment', amount, payment_id)

        A->>DB: COMMIT

        A->>R: INCR platform:revenue:daily:{date}
        A->>Q: Add job 'enrollment.confirmed'
        A->>Q: Add job 'teacher.notify_new_student'
        A->>Q: Add job 'schedule.calendar_event'

        A-->>YK: 200 OK
    else Уже обработан (идемпотентность)
        A->>DB: ROLLBACK
        A-->>YK: 200 OK
    end

    Note over P,W: === WEBHOOK: ОТМЕНЁННЫЙ ПЛАТЁЖ ===

    YK->>A: POST /api/payments/webhook<br/>{event: 'payment.canceled',<br/>object: {id: 'yk_xxx', status: 'canceled'}}

    A->>DB: UPDATE payments SET status='canceled'
    A->>DB: UPDATE enrollments SET status='canceled'
    A->>R: INCR class:{classId}:seats
    A->>Q: Add job 'waitlist.notify_next'
    A-->>YK: 200 OK

    Note over P,W: === ВОЗВРАТ СРЕДСТВ ===

    P->>A: POST /api/payments/{id}/refund<br/>{reason: 'class_canceled'}

    A->>DB: SELECT payment WHERE id = paymentId
    A->>DB: SELECT enrollment + class details

    Note over A: Расчёт суммы возврата:<br/>полный / пропорциональный

    A->>YK: POST /v3/refunds<br/>{payment_id: 'yk_xxx',<br/>amount: {value: '1500.00'}}
    YK-->>A: {id: 'ref_xxx', status: 'succeeded'}

    A->>DB: INSERT INTO refunds (payment_id, amount, status)
    A->>DB: UPDATE enrollments SET status='refunded'
    A->>R: INCR class:{classId}:seats
    A->>Q: Add job 'refund.notification'
    A-->>P: 200 {refundId, amount}

    Note over P,W: === ВЫПЛАТА УЧИТЕЛЮ (по расписанию) ===

    W->>DB: SELECT teacher_payouts<br/>WHERE period = current AND status = 'pending'
    DB-->>W: [{teacherId, totalAmount, commission}]

    loop Для каждого учителя
        W->>DB: SELECT teacher bank_details

        Note over W: netAmount = totalAmount * (1 - commissionRate)

        W->>YK: POST /v3/payouts<br/>{amount: {value: netAmount},<br/>payout_destination: {type: 'bank_account',<br/>...bankDetails}}

        alt Выплата успешна
            YK-->>W: {id: 'po_xxx', status: 'succeeded'}
            W->>DB: UPDATE teacher_payouts<br/>SET status='succeeded', external_id='po_xxx'
            W->>Q: Add job 'payout.notification'
        else Выплата отклонена
            YK-->>W: error
            W->>DB: UPDATE teacher_payouts<br/>SET status='failed', retry_count++
            W->>Q: Add job 'payout.retry' (delay: 1h)
            W->>Q: Add job 'admin.payout_alert'
        end
    end
```

### 4.3 Поток видеозанятия (Video Session Flow)

```mermaid
sequenceDiagram
    autonumber
    participant T as Учитель
    participant P as Родитель/Ребёнок
    participant W as Web App
    participant A as API
    participant DB as PostgreSQL
    participant R as Redis
    participant J as Jitsi Meet
    participant Q as Bull Queue

    Note over T,Q: === ЗА 15 МИНУТ ДО ЗАНЯТИЯ ===

    Q->>A: Job: prepare_video_room<br/>{sessionId}
    A->>DB: SELECT session + class + enrollments
    A->>J: POST /room/create<br/>{roomName: 'cls_{classId}_s_{sessionId}',<br/>config: {maxParticipants, startMuted}}
    J-->>A: {roomId, roomUrl}
    A->>DB: UPDATE sessions SET<br/>room_id=roomId, status='ready'

    A->>Q: Add job 'notification.reminder_15min'<br/>for all enrolled parents

    Note over T,Q: === УЧИТЕЛЬ ПОДКЛЮЧАЕТСЯ ===

    T->>W: Нажимает "Начать занятие"
    W->>A: POST /api/video/token<br/>{sessionId}

    A->>DB: SELECT session WHERE id = sessionId
    Note over A: Проверка: userId = teacherId<br/>AND session.status = 'ready'

    A->>A: Генерация JWT для Jitsi<br/>{room: roomId, role: 'moderator',<br/>name: teacherName, exp: +3h}
    A-->>W: {jitsiToken, roomUrl}

    W->>J: Подключение к комнате<br/>с JWT (роль: модератор)
    J-->>T: Видеопоток установлен

    A->>DB: UPDATE sessions SET<br/>status='in_progress',<br/>started_at=NOW()

    Note over T,Q: === УЧЕНИК ПОДКЛЮЧАЕТСЯ ===

    P->>W: Нажимает "Присоединиться"
    W->>A: POST /api/video/token<br/>{sessionId}

    A->>DB: SELECT enrollment WHERE<br/>child_id = childId<br/>AND session_id = sessionId<br/>AND status = 'active'

    alt Запись активна
        A->>A: Генерация JWT для Jitsi<br/>{room: roomId, role: 'participant',<br/>name: childName, exp: +3h}
        A-->>W: {jitsiToken, roomUrl}
        W->>J: Подключение к комнате<br/>с JWT (роль: участник)
        J-->>P: Видеопоток установлен

        A->>R: INCR session:{sessionId}:participants
        A->>DB: INSERT INTO attendance_log<br/>(session_id, child_id, joined_at)
    else Запись не найдена
        A-->>W: 403 Forbidden
    end

    Note over T,Q: === ПОТЕРЯ СВЯЗИ ===

    P--xJ: Соединение разорвано
    J->>A: Webhook: participant_left<br/>{roomId, participantId, reason: 'timeout'}
    A->>R: SET reconnect:{participantId}:{sessionId}<br/>TTL=300 (5 минут)

    Note over P: Ребёнок видит "Переподключение..."

    P->>W: Соединение восстановлено
    W->>A: POST /api/video/token<br/>{sessionId, reconnect: true}
    A->>R: GET reconnect:{participantId}:{sessionId}

    alt Сессия ещё активна
        A->>A: Новый JWT
        A-->>W: {jitsiToken, roomUrl}
        W->>J: Переподключение
        A->>R: DEL reconnect:{participantId}:{sessionId}
    else Время вышло (>5 мин)
        A-->>W: 410 Gone {message: "Сессия переподключения истекла"}
    end

    Note over T,Q: === ЗАВЕРШЕНИЕ ЗАНЯТИЯ ===

    T->>W: Нажимает "Завершить занятие"
    W->>A: POST /api/video/session/{sessionId}/end

    A->>J: POST /room/{roomId}/close
    J-->>A: OK (все участники отключены)

    A->>DB: UPDATE sessions SET<br/>status='completed',<br/>ended_at=NOW()

    A->>R: GET session:{sessionId}:participants
    A->>DB: UPDATE attendance_log SET<br/>left_at=NOW() WHERE session_id=sessionId

    A->>Q: Add job 'session.process_recording'
    A->>Q: Add job 'review.request'<br/>for all attended parents
    A->>Q: Add job 'analytics.session_completed'

    A-->>W: 200 {duration, participantCount}
    W-->>T: "Занятие завершено. Продолжительность: 45 мин"
```

---

## Легенда

| Элемент | Описание |
|---------|----------|
| **C1 — System Context** | Обзор системы, пользователи, внешние зависимости |
| **C2 — Containers** | Развёрнутые единицы (приложения, БД, сервисы) |
| **C3 — Components** | Внутренние модули одного контейнера (API Server) |
| **C4 — Code** | Детальные потоки данных на уровне классов и методов |

Все диаграммы выполнены в формате Mermaid и могут быть отрендерены в GitHub, GitLab, Notion или любом Markdown-редакторе с поддержкой Mermaid.
