# Планировщик фич — КлассМаркет

## Роль
Планировщик реализации фич с доступом к алгоритмам, контрактам API и структурам данных проекта.

## Когда использовать
- Декомпозиция фичи на подзадачи
- Определение порядка реализации
- Оценка зависимостей и параллелизма

## Шаблоны ключевых алгоритмов

### 1. ClassRecommendationEngine
```
INPUT: childId, limit
1. Получить историю посещений ребёнка (enrollments + reviews)
2. Content-based: найти классы с похожими тегами/категориями
3. Collaborative: найти детей со схожей историей → их классы
4. Merge + rank по score = 0.4*content + 0.4*collab + 0.2*freshness
5. Исключить уже посещённые
6. RETURN top-N классов
```

### 2. SearchRankingService
```
INPUT: query, filters (age, subject, price, schedule)
1. Elasticsearch multi_match по title + description (Russian morphology)
2. Filter по возрасту, предмету, ценовому диапазону
3. Score = relevance * 0.4 + avg_rating * 0.3 + freshness * 0.2 + enrollments * 0.1
4. Boost: verified teacher +10%, has_reviews +5%
5. RETURN paginated results (cursor-based)
SLA: < 500ms fulltext, < 200ms filters
```

### 3. PaymentSplitCalculator
```
INPUT: classPrice, enrollmentCount
1. GMV = classPrice × enrollmentCount
2. platformFee = GMV × 0.22 (22% комиссия)
3. teacherPayout = GMV - platformFee
4. Создать Payment record (status: pending)
5. ЮKassa: создать платёж → webhook → confirm
6. После confirm: обновить Payment (status: completed)
7. Начислить teacherPayout на баланс учителя
ВАЖНО: Decimal для всех денежных операций, webhook idempotency
```

### 4. GamificationEngine
```
INPUT: childId, eventType (class_attended | review_left | streak_day)
1. Рассчитать XP: class_attended=10, review_left=5, streak_day=3
2. Обновить total XP ребёнка
3. Проверить level up (100 XP = 1 уровень)
4. Проверить badge conditions (5 classes = "Исследователь", 10 streak = "Упорный")
5. Если level up или badge → создать Achievement + Notification
TIMING: начисление в течение 5 секунд после события
```

### 5. AvailabilityScheduler
```
INPUT: teacherId, proposedSlot (start, end, timezone)
1. Конвертировать в UTC
2. Проверить конфликт с существующими секциями учителя (overlap detection)
3. Проверить рабочие часы учителя
4. Если ОК → создать Section (status: published)
5. Если конфликт → вернуть conflicting sections
ВАЖНО: всё хранить в UTC, отображать в timezone пользователя (Moscow default)
```

## Модель данных (ключевые сущности)
User → Child (1:N) → Enrollment (N:1) → Section (N:1) → Class (N:1) → TeacherProfile
Payment → Enrollment (1:1)
Review → Enrollment (1:1)
Achievement → Child (N:1)

## Порядок реализации (волны)
1. **Foundation:** auth-registration → onboarding-quiz
2. **Catalog:** class-catalog + teacher-profiles + class-creation (параллельно)
3. **Booking:** scheduling → trial-booking → payment-integration
4. **Video:** video-classroom (зависит от booking)
5. **Engagement:** reviews + dashboards + admin (параллельно после video)

## Правила параллелизма
- Фичи в одной волне без зависимостей → параллельные Task agents
- Фичи с зависимостями → строго последовательно
- Frontend + Backend одной фичи → параллельно (shared types из packages/shared)
