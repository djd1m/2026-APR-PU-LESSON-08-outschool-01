# Coding Style — КлассМаркет

## TypeScript
- `strict: true` везде (tsconfig.json)
- Никогда `any` — использовать `unknown` + type guard
- Prefer `interface` для объектов, `type` для union/intersection
- Enum → `as const` object (tree-shakeable)

## NestJS Conventions
Каждый модуль следует паттерну:
```
modules/[name]/
├── [name].module.ts        # NestJS module
├── [name].controller.ts    # REST endpoints
├── [name].service.ts       # Business logic
├── [name].repository.ts    # Database queries (Prisma)
├── dto/
│   ├── create-[name].dto.ts
│   └── update-[name].dto.ts
├── entities/
│   └── [name].entity.ts    # Response types
└── [name].spec.ts          # Unit tests
```

## Naming
| Что | Формат | Пример |
|-----|--------|--------|
| Файлы | kebab-case | `class-enrollment.service.ts` |
| Классы/Interfaces | PascalCase | `ClassEnrollment` |
| Переменные/функции | camelCase | `getActiveEnrollments` |
| Константы | UPPER_SNAKE | `MAX_CLASS_SIZE` |
| DB таблицы | snake_case | `class_enrollments` |
| API endpoints | kebab-case | `/class-enrollments` |

## Error Handling
```typescript
// Иерархия исключений
AppException (base)
├── BadRequestException    // 400: validation errors
├── UnauthorizedException  // 401: auth required
├── ForbiddenException     // 403: no permission
├── NotFoundException      // 404: resource not found
└── ConflictException      // 409: duplicate, race condition
```

## API Response Format
```typescript
// Успех
{ success: true, data: T, meta?: { page, limit, total } }

// Ошибка
{ success: false, error: { code: string, message: string, details?: any } }
```

## Pagination
- Каталог/фиды: cursor-based (`?cursor=abc&limit=20`)
- Админка: offset-based (`?page=1&limit=50`)

## Import Order
```typescript
// 1. Node.js built-ins
import { join } from 'path';
// 2. External packages
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma/client';
// 3. Internal packages (@klassmarket/*)
import { UserRole } from '@klassmarket/shared';
// 4. Relative imports
import { CreateClassDto } from './dto/create-class.dto';
```

## Prisma
- Миграции: `YYYYMMDDHHMMSS_description` (автоматически)
- Seed: `prisma/seed.ts` — минимальный набор для dev
- Relations: always explicit `@relation` с `onDelete`
- Индексы: явно в schema, комментарий зачем

## Форматирование
- Prettier: printWidth 100, singleQuote true, trailingComma all
- ESLint: @typescript-eslint/recommended + NestJS rules
- Husky + lint-staged на pre-commit
