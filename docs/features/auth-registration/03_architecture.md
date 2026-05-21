# Архитектура: Аутентификация и регистрация

## Размещение компонентов

```
src/
  modules/
    auth/
      auth.module.ts              # NestJS модуль, импортирует PassportModule, JwtModule
      auth.controller.ts          # REST-контроллер: register, login, refresh, me, OAuth
      auth.service.ts             # Бизнес-логика: хеширование, генерация токенов, find-or-create
      strategies/
        jwt.strategy.ts           # Passport JWT RS256 — извлечение из cookie + header
        vk.strategy.ts            # Passport OAuth2 для VK ID
        yandex.strategy.ts        # Passport OAuth2 для Яндекс ID
      guards/
        jwt-auth.guard.ts         # AuthGuard('jwt') — защита маршрутов
        roles.guard.ts            # Проверка роли (PARENT, TEACHER, ADMIN)
      dto/
        register.dto.ts           # class-validator: email, password, role
        login.dto.ts              # class-validator: email, password
        refresh.dto.ts            # class-validator: refreshToken
  prisma/
    schema.prisma                 # Модели User, RefreshToken
```

## Зависимости модуля

```
AuthModule
  ├── imports: PassportModule, JwtModule.registerAsync(RS256_CONFIG)
  ├── imports: PrismaModule (для доступа к БД)
  ├── providers: AuthService, JwtStrategy, VkStrategy, YandexStrategy
  ├── controllers: AuthController
  └── exports: AuthService, JwtAuthGuard
```

## Схема данных (Prisma)

```prisma
model User {
  id             String    @id @default(uuid())
  email          String?   @unique
  passwordHash   String?
  role           Role      @default(PARENT)
  provider       AuthProvider @default(LOCAL)
  providerId     String?
  displayName    String?
  avatar         String?
  failedAttempts Int       @default(0)
  lastFailedAt   DateTime?
  createdAt      DateTime  @default(now())
  refreshTokens  RefreshToken[]
  @@unique([provider, providerId])
}

model RefreshToken {
  id        String   @id @default(uuid())
  tokenHash String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  expiresAt DateTime
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now())
}

enum Role { PARENT TEACHER ADMIN }
enum AuthProvider { LOCAL VK YANDEX }
```

## Диаграмма потока аутентификации

```
Клиент                    AuthController          AuthService            Passport          БД
  │                            │                      │                    │               │
  ├─ POST /auth/register ─────>│                      │                    │               │
  │                            ├─ register() ────────>│                    │               │
  │                            │                      ├─ bcrypt.hash() ───>│               │
  │                            │                      ├─ db.user.create() ─┼──────────────>│
  │                            │                      ├─ generateTokenPair()               │
  │<── { user, tokens } ──────┤                      │                    │               │
  │                            │                      │                    │               │
  ├─ GET /auth/vk ────────────>│                      │                    │               │
  │<── redirect VK OAuth ──────┤                      │                    │               │
  │                            │                      │                    │               │
  ├─ GET /auth/vk/callback ───>│                      │                    │               │
  │                            ├──────────────────────┼─ validate() ──────>│               │
  │                            │                      ├─ findOrCreate() ──>│──────────────>│
  │<── redirect + tokens ──────┤                      │                    │               │
```

## Границы модуля

- **AuthModule** не знает о бизнес-логике занятий, профилей, платежей
- **JwtAuthGuard** экспортируется для использования другими модулями
- **RolesGuard** используется совместно с декоратором `@Roles(Role.TEACHER)`
- OAuth-стратегии конфигурируются через переменные окружения (VK_CLIENT_ID, YANDEX_CLIENT_ID)
- RS256 ключи читаются из файловой системы: `keys/jwt-private.pem`, `keys/jwt-public.pem`

## Интеграционные точки

| Потребитель | Что использует | Способ |
|-------------|---------------|--------|
| Все модули | JwtAuthGuard | Import guard |
| UsersModule | User entity | Prisma relation |
| Frontend | access-токен | httpOnly cookie или Authorization header |
| Mobile (будущее) | access-токен | Authorization: Bearer header |
