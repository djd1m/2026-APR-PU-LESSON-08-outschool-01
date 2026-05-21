# Feature: Аутентификация и регистрация

**ID:** auth-registration
**Branch:** feature/001-auth-registration
**Epic:** E1
**Stories:** US-001, US-002, US-003, US-004
**Effort:** XL
**Status:** done

## Описание

Полный цикл аутентификации пользователей: регистрация по email/паролю, вход через VK ID и Яндекс ID (OAuth 2.0), а также выдача и обновление JWT-токенов. Поддерживается извлечение токена как из cookie, так и из заголовка Authorization. OAuth-провайдеры реализуют стратегию find-or-create для автоматического создания аккаунта при первом входе.

## Реализованные компоненты

### Backend
- `src/modules/auth/auth.controller.ts` — контроллер маршрутов аутентификации
- `src/modules/auth/auth.service.ts` — бизнес-логика регистрации, входа, обновления токенов
- `src/modules/auth/strategies/jwt.strategy.ts` — RS256 JWT стратегия Passport
- `src/modules/auth/strategies/vk.strategy.ts` — OAuth VK ID стратегия
- `src/modules/auth/strategies/yandex.strategy.ts` — OAuth Яндекс ID стратегия
- `src/modules/auth/guards/jwt-auth.guard.ts` — guard для защищенных маршрутов
- `prisma/schema.prisma` — модель User с полями provider, providerId

### Frontend
- `src/pages/LoginPage.tsx` — страница входа с формой и OAuth-кнопками
- `src/pages/RegisterPage.tsx` — страница регистрации
- `src/components/auth/OAuthButtons.tsx` — кнопки VK ID и Яндекс ID
- `src/hooks/useAuth.ts` — хук управления состоянием аутентификации
- `src/api/auth.ts` — API-клиент для эндпоинтов аутентификации

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/register | No | Регистрация по email/паролю |
| POST | /auth/login | No | Вход по email/паролю, выдача access+refresh токенов |
| POST | /auth/refresh | No | Обновление access-токена по refresh-токену |
| GET | /auth/me | Yes | Получение профиля текущего пользователя |
| GET | /auth/vk | No | Редирект на VK ID OAuth |
| GET | /auth/vk/callback | No | Callback VK ID, find-or-create пользователя |
| GET | /auth/yandex | No | Редирект на Яндекс ID OAuth |
| GET | /auth/yandex/callback | No | Callback Яндекс ID, find-or-create пользователя |

## Ключевые решения
- RS256 (асимметричные ключи) для JWT вместо HS256 — позволяет верифицировать токены без доступа к секретному ключу
- Двойное извлечение токена: cookie (httpOnly, secure) для браузера + заголовок Authorization для мобильных клиентов
- OAuth find-or-create: при первом входе через VK/Яндекс автоматически создается аккаунт, при повторном — привязывается существующий
- Refresh-токены хранятся в БД с возможностью отзыва (revoke)
