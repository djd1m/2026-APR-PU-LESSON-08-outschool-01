# Testing Rules — КлассМаркет

## Тестовая пирамида
```
        /  E2E  \          5% — Playwright (5 critical journeys)
       / Integr. \        15% — Testcontainers (API + DB + Redis)
      /   Unit    \       80% — Vitest (services, utils, algorithms)
```

## Покрытие (coverage targets)
| Слой | Target | Обоснование |
|------|:------:|-------------|
| Services (business logic) | 80%+ | Ядро приложения |
| Payment logic | 90%+ | Деньги — критично |
| Controllers | 70%+ | Валидация + маршрутизация |
| Utils / Shared | 90%+ | Переиспользуемый код |
| Frontend components | 60%+ | UI менее критичен |

## Unit Tests (Vitest)
```typescript
// Naming convention
describe('ClassEnrollmentService', () => {
  it('should create enrollment when section has available seats', async () => { ... });
  it('should throw ConflictException when section is full', async () => { ... });
  it('should throw ForbiddenException when child not linked to parent', async () => { ... });
});
```

- Mock external services: ЮKassa, Jitsi, VK ID, Яндекс ID, email
- Не мокать Prisma — использовать in-memory SQLite или Testcontainers
- Один тест — одна проверка (SRP)

## Integration Tests (Testcontainers)
```typescript
// Setup
const postgres = new PostgreSqlContainer('postgres:15').start();
const redis = new GenericContainer('redis:7').start();
const elasticsearch = new ElasticsearchContainer('elasticsearch:8').start();
```

Покрывать:
- Все API endpoints (happy path + errors)
- Payment webhooks (ЮKassa callback simulation)
- Search queries (Elasticsearch with Russian analyzer)
- Background jobs (BullMQ processing)

## E2E Tests (Playwright) — 5 критических маршрутов

### 1. Родитель: регистрация → онбординг → поиск → пробное занятие → посещение
```gherkin
Given новый пользователь на странице регистрации
When регистрируется через email
And проходит онбординг-квиз
And ищет класс по предмету
And записывается на пробное занятие
Then занятие отображается в расписании
```

### 2. Учитель: регистрация → верификация → создание класса → проведение → вывод
```gherkin
Given новый учитель на странице регистрации
When регистрируется и проходит верификацию
And создаёт класс
And класс одобрен модератором
And проводит занятие
Then заработок отображается в дашборде
```

### 3. Полный цикл оплаты: оплата → посещение → отзыв
### 4. Реферальная программа: приглашение → регистрация → бонус
### 5. Админ: одобрение учителя → модерация отзыва

## Mock-паттерны

### ЮKassa Payment Mock
```typescript
class YooKassaMock {
  createPayment(amount: Decimal, description: string): Payment {
    return { id: uuid(), status: 'pending', confirmation: { confirmation_url: 'https://mock' } };
  }
  simulateWebhook(paymentId: string, event: 'succeeded' | 'canceled'): WebhookPayload { ... }
}
```

### Jitsi Room Mock
```typescript
class JitsiMock {
  createRoom(sectionId: string): { roomName: string, jwt: string } { ... }
  simulateJoin(roomName: string, userId: string): void { ... }
}
```

### VK ID OAuth Mock
```typescript
class VkIdMock {
  getAuthUrl(): string { return 'https://mock/vk-auth'; }
  exchangeCode(code: string): { access_token: string, user: VkUser } { ... }
}
```

## Fixture Factories
```typescript
// @faker-js/faker
const classFactory = {
  build: (overrides?: Partial<Class>) => ({
    id: faker.string.uuid(),
    title: faker.lorem.words(3),
    description: faker.lorem.paragraph(),
    price: faker.number.int({ min: 500, max: 3000 }),
    ageMin: 7, ageMax: 14,
    maxStudents: 12,
    ...overrides,
  }),
};
```

## CI Integration
```yaml
# В GitHub Actions
test:
  script:
    - npm run test:unit        # Vitest
    - npm run test:integration  # Testcontainers (needs Docker)
    - npm run test:e2e          # Playwright (needs running app)
  coverage:
    - npm run test:coverage -- --reporter=lcov
    - upload coverage to Codecov
```

## Антипаттерны
- ❌ Тесты зависят друг от друга (порядок выполнения)
- ❌ Тесты зависят от внешних API (всегда mock)
- ❌ Snapshot tests для динамических данных
- ❌ `sleep()` в тестах (использовать `waitFor`)
- ❌ Игнорирование flaky tests (исправить или удалить)
