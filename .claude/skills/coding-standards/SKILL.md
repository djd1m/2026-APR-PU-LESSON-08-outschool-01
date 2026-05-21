---
name: coding-standards
description: >
  Шаблоны кода и паттерны для КлассМаркет. NestJS module/service/controller templates,
  Prisma schema conventions, API response format, error handling. Используй при создании
  новых модулей, эндпоинтов или сервисов.
version: "1.0"
maturity: production
---

# Coding Standards — КлассМаркет

## NestJS Module Template

```typescript
// modules/classes/classes.module.ts
import { Module } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { ClassesRepository } from './classes.repository';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [SearchModule],
  controllers: [ClassesController],
  providers: [ClassesService, ClassesRepository],
  exports: [ClassesService],
})
export class ClassesModule {}
```

## NestJS Service Template

```typescript
// modules/classes/classes.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ClassesRepository } from './classes.repository';
import { CreateClassDto } from './dto/create-class.dto';

@Injectable()
export class ClassesService {
  constructor(private readonly repo: ClassesRepository) {}

  async create(teacherId: string, dto: CreateClassDto) {
    return this.repo.create({ ...dto, teacherId });
  }

  async findById(id: string) {
    const cls = await this.repo.findById(id);
    if (!cls) throw new NotFoundException(`Class ${id} not found`);
    return cls;
  }

  async findAll(filters: ClassFilters) {
    return this.repo.findAll(filters);
  }
}
```

## NestJS Controller Template

```typescript
// modules/classes/classes.controller.ts
import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { ApiResponse } from '../../common/types/api-response';

@Controller('classes')
export class ClassesController {
  constructor(private readonly service: ClassesService) {}

  @Get()
  async findAll(@Query() filters: ClassFiltersDto): Promise<ApiResponse<Class[]>> {
    const { data, total } = await this.service.findAll(filters);
    return { success: true, data, meta: { total, ...filters } };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('teacher')
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateClassDto,
  ): Promise<ApiResponse<Class>> {
    const cls = await this.service.create(user.id, dto);
    return { success: true, data: cls };
  }
}
```

## DTO Template (Zod + class-validator)

```typescript
// modules/classes/dto/create-class.dto.ts
import { IsString, IsNumber, IsInt, Min, Max, MinLength, MaxLength } from 'class-validator';

export class CreateClassDto {
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  description: string;

  @IsString()
  subject: string;

  @IsNumber()
  @Min(500)
  @Max(10000)
  price: number;

  @IsInt()
  @Min(3)
  @Max(18)
  ageMin: number;

  @IsInt()
  @Min(3)
  @Max(18)
  ageMax: number;

  @IsInt()
  @Min(1)
  @Max(12)
  maxStudents: number;
}
```

## Prisma Schema Conventions

```prisma
// Naming: snake_case для таблиц и полей, PascalCase для моделей
model Class {
  id          String   @id @default(uuid())
  title       String   @db.VarChar(100)
  description String   @db.Text
  subject     String   @db.VarChar(50)
  price       Decimal  @db.Decimal(10, 2)  // Всегда Decimal для денег!
  age_min     Int      @db.SmallInt
  age_max     Int      @db.SmallInt
  max_students Int     @db.SmallInt @default(12)
  status      ClassStatus @default(DRAFT)

  teacher_id  String
  teacher     TeacherProfile @relation(fields: [teacher_id], references: [id], onDelete: CASCADE)

  sections    Section[]
  reviews     Review[]

  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  @@index([subject, age_min, age_max])
  @@index([teacher_id])
  @@index([status, created_at(sort: Desc)])
  @@map("classes")
}

enum ClassStatus {
  DRAFT
  PENDING_REVIEW
  PUBLISHED
  ARCHIVED
}
```

## API Response Wrapper

```typescript
// common/types/api-response.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: PaginationMeta;
  error?: ErrorDetail;
}

export interface PaginationMeta {
  total: number;
  page?: number;
  limit: number;
  cursor?: string;
  hasMore?: boolean;
}

export interface ErrorDetail {
  code: string;
  message: string;
  details?: Record<string, any>;
}
```

## Error Handling Pattern

```typescript
// common/filters/http-exception.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : 500;

    const message = exception instanceof HttpException
      ? exception.message
      : 'Internal server error';

    response.status(status).json({
      success: false,
      error: { code: `ERR_${status}`, message },
    });

    if (status >= 500) {
      this.logger.error('Unhandled exception', exception);
    }
  }
}
```

## Environment Config (Zod)

```typescript
// config/env.schema.ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  ELASTICSEARCH_URL: z.string().url(),
  YOOKASSA_SHOP_ID: z.string().min(1),
  YOOKASSA_SECRET_KEY: z.string().min(1),
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  VK_CLIENT_ID: z.string().min(1),
  VK_CLIENT_SECRET: z.string().min(1),
  YANDEX_CLIENT_ID: z.string().min(1),
  YANDEX_CLIENT_SECRET: z.string().min(1),
  JITSI_URL: z.string().url(),
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;
```

## BullMQ Job Template

```typescript
// workers/email/email.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('email')
export class EmailProcessor extends WorkerHost {
  async process(job: Job<EmailJobData>) {
    const { to, subject, template, data } = job.data;
    await this.mailer.send({ to, subject, template, data });
    return { sent: true };
  }
}
```
