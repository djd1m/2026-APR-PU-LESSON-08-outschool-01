# Псевдокод: Маркетплейс онлайн-классов для детей (Outschool RU)

## 1. Структуры данных (TypeScript-типы)

### 1.1. Пользователи и профили

```typescript
// === Базовые типы ===

type UUID = string; // формат uuid v4
type ISODateTime = string; // ISO 8601
type Money = number; // копейки (целое число, 100 = 1 рубль)

enum UserRole {
  PARENT = 'parent',
  TEACHER = 'teacher',
  ADMIN = 'admin',
}

enum AuthProvider {
  EMAIL = 'email',
  VK_ID = 'vk_id',
  YANDEX_ID = 'yandex_id',
}

// === User ===

interface User {
  id: UUID;
  email: string;
  phone: string | null;
  passwordHash: string | null; // null для OAuth-пользователей
  role: UserRole;
  authProvider: AuthProvider;
  externalAuthId: string | null; // ID во внешней системе (VK, Яндекс)
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  is2FAEnabled: boolean;
  referralCode: string; // уникальный 8-символьный код
  referredByUserId: UUID | null;
  lastLoginAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt: ISODateTime | null; // soft delete
}

// === Child ===

interface Child {
  id: UUID;
  parentId: UUID; // FK → User
  firstName: string;
  birthDate: string; // YYYY-MM-DD
  avatarUrl: string | null;
  interests: string[]; // ['programming', 'art', 'math', ...]
  xp: number; // текущие очки опыта
  level: number; // текущий уровень
  streakDays: number; // текущая серия посещений
  maxStreakDays: number; // рекордная серия
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// === TeacherProfile ===

enum TeacherVerificationStatus {
  PENDING_VERIFICATION = 'pending_verification',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

interface TeacherProfile {
  id: UUID;
  userId: UUID; // FK → User
  status: TeacherVerificationStatus;
  bio: string; // markdown, описание опыта
  education: string; // описание образования
  specializations: string[]; // ['mathematics', 'english', ...]
  experienceYears: number;
  diplomaDocumentUrl: string; // ссылка на файл в MinIO
  backgroundCheckUrl: string; // справка об отсутствии судимости
  introVideoUrl: string | null; // видео-визитка
  rating: number; // средний рейтинг (1.0-5.0), пересчитывается
  reviewCount: number; // кол-во отзывов
  totalStudents: number; // общее кол-во уникальных учеников
  balanceKopecks: Money; // доступно к выводу (в копейках)
  totalEarnedKopecks: Money; // всего заработано
  taxStatus: 'self_employed' | 'individual_entrepreneur' | 'not_set';
  verifiedAt: ISODateTime | null;
  verifiedByAdminId: UUID | null;
  rejectionReason: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
```

### 1.2. Классы и секции

```typescript
// === Class ===

enum ClassStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  PUBLISHED = 'published',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

enum ClassFormat {
  ONE_TIME = 'one_time',     // разовое занятие
  COURSE = 'course',         // серия занятий
  SUBSCRIPTION = 'subscription', // подписка (v2.0)
}

interface Class {
  id: UUID;
  teacherId: UUID; // FK → TeacherProfile
  title: string; // 5-100 символов
  slug: string; // URL-friendly идентификатор
  description: string; // markdown, 100-5000 символов
  shortDescription: string; // для карточки, <=200 символов
  categoryId: UUID; // FK → Category
  subcategoryId: UUID | null;
  ageMin: number; // 3-18
  ageMax: number; // 3-18
  format: ClassFormat;
  durationMinutes: number; // 30 | 45 | 60 | 90
  maxStudents: number; // 1-20
  priceKopecks: Money; // цена за занятие
  coursePriceKopecks: Money | null; // цена за весь курс (если формат=course)
  hasTrialClass: boolean;
  coverImageUrl: string | null;
  previewVideoUrl: string | null;
  requirements: string | null; // что нужно ученику
  status: ClassStatus;
  rating: number; // средний рейтинг (1.0-5.0)
  reviewCount: number;
  enrollmentCount: number; // общее кол-во записей
  tags: string[]; // теги для поиска
  moderatedAt: ISODateTime | null;
  moderatedByAdminId: UUID | null;
  publishedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// === Section (запланированное занятие) ===

enum SectionStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

interface Section {
  id: UUID;
  classId: UUID; // FK → Class
  title: string | null; // опциональное название (напр. "Урок 3: Циклы")
  orderIndex: number; // порядок в курсе
  startTime: ISODateTime; // дата и время начала (UTC)
  endTime: ISODateTime; // дата и время окончания (UTC)
  timezone: string; // IANA timezone (напр. 'Europe/Moscow')
  maxStudents: number; // наследуется от Class, но можно переопределить
  currentStudents: number; // текущее кол-во записавшихся
  status: SectionStatus;
  isTrial: boolean; // пробное занятие
  videoRoomId: string | null; // ID комнаты Jitsi/LiveKit
  recordingUrl: string | null; // ссылка на запись (после завершения)
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
```

### 1.3. Записи, отзывы, платежи

```typescript
// === Enrollment ===

enum EnrollmentStatus {
  PENDING = 'pending',       // ожидает оплаты
  CONFIRMED = 'confirmed',   // оплачено, ожидает занятия
  ACTIVE = 'active',         // занятие идёт
  COMPLETED = 'completed',   // занятие завершено
  CANCELLED = 'cancelled',   // отменено пользователем
  REFUNDED = 'refunded',     // возвращены деньги
}

interface Enrollment {
  id: UUID;
  childId: UUID; // FK → Child
  sectionId: UUID; // FK → Section
  parentId: UUID; // FK → User (кто платил)
  status: EnrollmentStatus;
  paymentId: UUID | null; // FK → Payment
  attendedAt: ISODateTime | null; // когда ребёнок присоединился к занятию
  xpEarned: number; // сколько XP начислено за это занятие
  cancelledAt: ISODateTime | null;
  cancelReason: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// === Review ===

enum ReviewStatus {
  PENDING_MODERATION = 'pending_moderation',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
}

interface Review {
  id: UUID;
  classId: UUID; // FK → Class
  parentId: UUID; // FK → User
  childId: UUID; // FK → Child
  enrollmentId: UUID; // FK → Enrollment
  rating: number; // 1-5
  text: string; // минимум 50 символов
  status: ReviewStatus;
  moderatedAt: ISODateTime | null;
  moderatedByAdminId: UUID | null;
  rejectionReason: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// === Payment ===

enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

enum PaymentType {
  CLASS_PAYMENT = 'class_payment',
  TEACHER_WITHDRAWAL = 'teacher_withdrawal',
  REFUND = 'refund',
}

interface Payment {
  id: UUID;
  externalId: string | null; // ID транзакции в ЮKassa
  userId: UUID; // FK → User (плательщик или получатель)
  enrollmentId: UUID | null; // FK → Enrollment (для оплаты класса)
  type: PaymentType;
  amountKopecks: Money; // сумма в копейках
  commissionKopecks: Money; // комиссия платформы (20%)
  teacherAmountKopecks: Money; // сумма преподавателю (80%)
  currency: 'RUB';
  status: PaymentStatus;
  paymentMethod: string | null; // 'bank_card', 'yoo_money', 'sbp'
  receiptUrl: string | null; // ссылка на чек (54-ФЗ)
  refundedAmountKopecks: Money; // сумма возврата
  metadata: Record<string, unknown>; // доп. данные от ЮKassa
  processedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// === Achievement (Badge) ===

interface Achievement {
  id: UUID;
  slug: string; // уникальный идентификатор бейджа
  name: string; // "Первое занятие", "Серия 7 дней" и т.д.
  description: string;
  iconUrl: string;
  category: 'attendance' | 'learning' | 'social' | 'special';
  condition: AchievementCondition;
  xpReward: number; // сколько XP даётся при получении
  createdAt: ISODateTime;
}

interface AchievementCondition {
  type: 'attendance_count' | 'streak_days' | 'review_count'
      | 'course_completed' | 'categories_count' | 'xp_threshold';
  threshold: number; // например, 10 занятий, 7 дней серия
}

interface ChildAchievement {
  id: UUID;
  childId: UUID; // FK → Child
  achievementId: UUID; // FK → Achievement
  earnedAt: ISODateTime;
}

// === Notification ===

enum NotificationType {
  ENROLLMENT_CONFIRMED = 'enrollment_confirmed',
  CLASS_REMINDER = 'class_reminder',  // за 15 мин до занятия
  CLASS_CANCELLED = 'class_cancelled',
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILED = 'payment_failed',
  REVIEW_PUBLISHED = 'review_published',
  TEACHER_VERIFIED = 'teacher_verified',
  TEACHER_REJECTED = 'teacher_rejected',
  BADGE_EARNED = 'badge_earned',
  WITHDRAWAL_COMPLETED = 'withdrawal_completed',
  REFERRAL_BONUS = 'referral_bonus',
}

interface Notification {
  id: UUID;
  userId: UUID; // FK → User
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>; // payload для deep linking
  isRead: boolean;
  channel: 'email' | 'push' | 'in_app';
  sentAt: ISODateTime | null;
  readAt: ISODateTime | null;
  createdAt: ISODateTime;
}

// === Category ===

interface Category {
  id: UUID;
  slug: string;
  name: string; // "Программирование", "Математика" и т.д.
  parentId: UUID | null; // для подкатегорий
  iconUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}
```

---

## 2. Основные алгоритмы

### 2.1. AI-рекомендации классов (гибридный подход: collaborative + content-based filtering)

```
АЛГОРИТМ: generateRecommendations(childId: UUID) → Class[]

ВХОДНЫЕ ДАННЫЕ:
  child = загрузитьРебёнка(childId)
  enrollmentHistory = загрузитьИсториюЗаписей(childId)
  childInterests = child.interests  // ['programming', 'math', ...]
  childAge = вычислитьВозраст(child.birthDate)
  allPublishedClasses = загрузитьКлассы(status = 'published')

ПРОЦЕСС:

  // === Шаг 1: Content-Based Score (на основе профиля) ===
  ДЛЯ КАЖДОГО class В allPublishedClasses:
    contentScore = 0

    // Совпадение интересов (0-40 баллов)
    matchingInterests = ПЕРЕСЕЧЕНИЕ(childInterests, class.tags)
    contentScore += (matchingInterests.length / childInterests.length) * 40

    // Соответствие возрасту (0-30 баллов)
    ЕСЛИ childAge >= class.ageMin И childAge <= class.ageMax:
      // Идеальное попадание в середину диапазона
      ageCenter = (class.ageMin + class.ageMax) / 2
      ageDistance = ABS(childAge - ageCenter) / (class.ageMax - class.ageMin + 1)
      contentScore += (1 - ageDistance) * 30
    ИНАЧЕ:
      contentScore += 0  // возраст не подходит

    // Рейтинг преподавателя (0-20 баллов)
    contentScore += (class.rating / 5.0) * 20

    // Популярность (0-10 баллов)
    normalizedPopularity = MIN(class.enrollmentCount / 100, 1.0)
    contentScore += normalizedPopularity * 10

    class._contentScore = contentScore

  // === Шаг 2: Collaborative Filtering Score (на основе похожих пользователей) ===
  // Найти детей с похожими паттернами записей
  similarChildren = найтиПохожихДетей(childId, enrollmentHistory, limit = 50)

  // Подсчитать, на какие классы записывались похожие дети
  collaborativeScores = {} // classId → score
  ДЛЯ КАЖДОГО similarChild В similarChildren:
    similarity = вычислитьКосинусноеСходство(
      enrollmentHistory,
      загрузитьИсториюЗаписей(similarChild.id)
    )
    theirClasses = загрузитьИсториюЗаписей(similarChild.id)
    ДЛЯ КАЖДОГО enrollment В theirClasses:
      ЕСЛИ enrollment.classId НЕ В enrollmentHistory:
        collaborativeScores[enrollment.classId] += similarity

  // Нормализовать collaborative scores (0-100)
  maxCollabScore = МАКС(ЗНАЧЕНИЯ(collaborativeScores)) ИЛИ 1
  ДЛЯ КАЖДОГО classId В collaborativeScores:
    collaborativeScores[classId] = (collaborativeScores[classId] / maxCollabScore) * 100

  // === Шаг 3: Гибридный скоринг ===
  ЕСЛИ enrollmentHistory.length < 3:
    // Холодный старт: полагаемся на content-based
    contentWeight = 0.8
    collaborativeWeight = 0.2
  ИНАЧЕ:
    contentWeight = 0.4
    collaborativeWeight = 0.6

  ДЛЯ КАЖДОГО class В allPublishedClasses:
    collabScore = collaborativeScores[class.id] ИЛИ 0
    class._finalScore = class._contentScore * contentWeight
                      + collabScore * collaborativeWeight

    // === Штрафы и бонусы ===
    // Штраф за уже просмотренные, но не записанные
    ЕСЛИ class.id В просмотренныеНоНеЗаписанные(childId):
      class._finalScore *= 0.7

    // Бонус за наличие пробного занятия
    ЕСЛИ class.hasTrialClass:
      class._finalScore *= 1.15

    // Штраф за полные секции
    ЕСЛИ ВСЕ секции class ПОЛНЫ:
      class._finalScore *= 0.3

    // Бонус за свежие классы (опубликованы <7 дней назад)
    ЕСЛИ (СЕЙЧАС - class.publishedAt).дни < 7:
      class._finalScore *= 1.1

  // === Шаг 4: Сортировка и возврат ===
  recommendations = ОТФИЛЬТРОВАТЬ allPublishedClasses ГДЕ:
    - childAge В [class.ageMin, class.ageMax]
    - class.id НЕ В enrollmentHistory  // исключить уже записанные
    - class._finalScore > 10  // минимальный порог релевантности

  СОРТИРОВАТЬ recommendations ПО _finalScore УБЫВАНИЕ
  ВЕРНУТЬ recommendations[0:20]  // топ-20 рекомендаций
```

### 2.2. Teacher-Student Matching (подбор преподавателя)

```
АЛГОРИТМ: findBestTeachers(childId: UUID, categoryId: UUID) → TeacherProfile[]

ВХОДНЫЕ ДАННЫЕ:
  child = загрузитьРебёнка(childId)
  childAge = вычислитьВозраст(child.birthDate)
  category = загрузитьКатегорию(categoryId)
  teachers = загрузитьПреподавателей(
    status = 'verified',
    specializations СОДЕРЖИТ category.slug
  )
  previousEnrollments = загрузитьЗаписиРебёнка(childId)

ПРОЦЕСС:
  ДЛЯ КАЖДОГО teacher В teachers:
    score = 0

    // Рейтинг (0-30)
    score += (teacher.rating / 5.0) * 30

    // Опыт работы с целевой возрастной группой (0-25)
    ageGroupStudents = ПОДСЧИТАТЬ(teacher.enrollments ГДЕ
      student.age В [childAge - 1, childAge + 1])
    totalStudents = teacher.totalStudents ИЛИ 1
    ageGroupRatio = MIN(ageGroupStudents / totalStudents, 1.0)
    score += ageGroupRatio * 25

    // Количество завершённых классов в категории (0-20)
    categoryClasses = ПОДСЧИТАТЬ(teacher.classes ГДЕ
      categoryId = category.id И status = 'completed')
    score += MIN(categoryClasses / 10, 1.0) * 20

    // Отзывчивость — среднее время ответа на вопросы (0-15)
    avgResponseTime = вычислитьСреднееВремяОтвета(teacher.id)
    ЕСЛИ avgResponseTime < 1ч: score += 15
    ИНАЧЕ ЕСЛИ avgResponseTime < 4ч: score += 10
    ИНАЧЕ ЕСЛИ avgResponseTime < 24ч: score += 5
    ИНАЧЕ: score += 0

    // Наличие свободных слотов в ближайшие 7 дней (0-10)
    availableSlots = ПОДСЧИТАТЬ(teacher.sections ГДЕ
      startTime > СЕЙЧАС И startTime < СЕЙЧАС + 7д
      И currentStudents < maxStudents)
    score += MIN(availableSlots / 5, 1.0) * 10

    teacher._matchScore = score

  СОРТИРОВАТЬ teachers ПО _matchScore УБЫВАНИЕ
  ВЕРНУТЬ teachers[0:10]
```

### 2.3. Поисковый ранкинг (Search Ranking)

```
АЛГОРИТМ: searchClasses(query: string, filters: SearchFilters) → SearchResult

ВХОДНЫЕ ДАННЫЕ:
  query = строка поиска (может быть пустой)
  filters = {
    ageGroup?: [min, max],
    categoryId?: UUID,
    priceRange?: [min, max],  // в копейках
    format?: ClassFormat,
    daysOfWeek?: number[],    // 0=ПН, 6=ВС
    timeRange?: [startHour, endHour],
    rating?: number,          // минимальный рейтинг
    hasTrialClass?: boolean,
  }

ПРОЦЕСС:
  // === Шаг 1: Elasticsearch запрос ===
  esQuery = {
    bool: {
      must: [],
      filter: [],
      should: [],
    }
  }

  // Текстовый поиск (multi-match с бустом)
  ЕСЛИ query НЕ ПУСТОЙ:
    esQuery.must.ДОБАВИТЬ({
      multi_match: {
        query: query,
        fields: [
          "title^3",        // заголовок — наивысший приоритет
          "description^1",
          "tags^2",
          "teacher.name^1.5",
          "category.name^2",
        ],
        type: "best_fields",
        fuzziness: "AUTO",  // исправление опечаток
        analyzer: "russian_morphology",  // морфология русского языка
      }
    })

  // Фильтры (не влияют на score, только отсеивают)
  ЕСЛИ filters.ageGroup:
    esQuery.filter.ДОБАВИТЬ({
      range: { ageMin: { lte: filters.ageGroup[1] } },
      range: { ageMax: { gte: filters.ageGroup[0] } },
    })

  ЕСЛИ filters.categoryId:
    esQuery.filter.ДОБАВИТЬ({ term: { categoryId: filters.categoryId } })

  ЕСЛИ filters.priceRange:
    esQuery.filter.ДОБАВИТЬ({
      range: { priceKopecks: { gte: filters.priceRange[0], lte: filters.priceRange[1] } }
    })

  ЕСЛИ filters.hasTrialClass:
    esQuery.filter.ДОБАВИТЬ({ term: { hasTrialClass: true } })

  esQuery.filter.ДОБАВИТЬ({ term: { status: 'published' } })

  // Бустеры (should — не обязательны, но повышают score)
  // Буст за рейтинг
  esQuery.should.ДОБАВИТЬ({
    function_score: {
      field_value_factor: {
        field: "rating",
        modifier: "log1p",
        factor: 2,
      }
    }
  })

  // Буст за свежесть (decay function)
  esQuery.should.ДОБАВИТЬ({
    function_score: {
      exp: {
        publishedAt: {
          origin: "now",
          scale: "30d",
          decay: 0.5,
        }
      }
    }
  })

  // Буст за наличие свободных мест
  esQuery.should.ДОБАВИТЬ({
    function_score: {
      script_score: {
        script: "doc['maxStudents'].value - doc['currentStudents'].value > 0 ? 1.5 : 0"
      }
    }
  })

  // === Шаг 2: Выполнение запроса ===
  results = elasticsearch.search(esQuery, {
    from: filters.offset ИЛИ 0,
    size: filters.limit ИЛИ 20,
    highlight: { fields: { title: {}, description: {} } },
  })

  // === Шаг 3: Обогащение результатов ===
  ДЛЯ КАЖДОГО hit В results.hits:
    hit.nextAvailableSection = загрузитьБлижайшуюСекцию(hit.classId)
    hit.teacherPreview = загрузитьПревьюПреподавателя(hit.teacherId)

  ВЕРНУТЬ {
    items: results.hits,
    total: results.total,
    took: results.took,  // время выполнения в ms
    facets: {  // агрегации для фильтров
      categories: results.aggregations.categories,
      priceRanges: results.aggregations.priceRanges,
      ageGroups: results.aggregations.ageGroups,
    }
  }
```

### 2.4. Расчёт комиссии и распределение платежа (Payment Split)

```
АЛГОРИТМ: processPayment(enrollmentId: UUID) → Payment

КОНСТАНТЫ:
  PLATFORM_COMMISSION_RATE = 0.20  // 20% комиссия платформы
  YUKASSA_COMMISSION_RATE = 0.035  // 3.5% комиссия ЮKassa
  MIN_TEACHER_PAYOUT_KOPECKS = 100_000  // 1000 руб. мин. вывод

ВХОДНЫЕ ДАННЫЕ:
  enrollment = загрузитьЗапись(enrollmentId)
  section = загрузитьСекцию(enrollment.sectionId)
  class = загрузитьКласс(section.classId)
  teacher = загрузитьПрофильПреподавателя(class.teacherId)

ПРОЦЕСС:
  // === Шаг 1: Определить сумму ===
  ЕСЛИ section.isTrial:
    ВЕРНУТЬ создатьБесплатнуюЗапись(enrollment)

  // Цена за одно занятие или за весь курс
  ЕСЛИ class.format = 'course' И class.coursePriceKopecks != null:
    totalAmount = class.coursePriceKopecks
  ИНАЧЕ:
    totalAmount = class.priceKopecks

  // === Шаг 2: Применить скидки ===
  discount = 0

  // Промокод
  ЕСЛИ enrollment.promoCode:
    promo = загрузитьПромокод(enrollment.promoCode)
    ЕСЛИ promo.type = 'percentage':
      discount = totalAmount * (promo.value / 100)
    ИНАЧЕ ЕСЛИ promo.type = 'fixed':
      discount = promo.value
    discount = MIN(discount, promo.maxDiscountKopecks ИЛИ discount)

  // Реферальный бонус (только первая оплата)
  ЕСЛИ этоПерваяОплата(enrollment.parentId) И пользовательПриглашён(enrollment.parentId):
    discount += 30_000  // 300 руб. скидка приглашённому

  totalAmount = МАКС(totalAmount - discount, 0)

  // === Шаг 3: Рассчитать распределение ===
  yukassaFee = ОКРУГЛИТЬ(totalAmount * YUKASSA_COMMISSION_RATE)
  platformCommission = ОКРУГЛИТЬ(totalAmount * PLATFORM_COMMISSION_RATE)
  teacherAmount = totalAmount - platformCommission
  // Примечание: комиссия ЮKassa включена в комиссию платформы

  // === Шаг 4: Создать платёж в ЮKassa ===
  yukassaPayment = yukassaClient.createPayment({
    amount: { value: totalAmount / 100, currency: 'RUB' },
    confirmation: { type: 'redirect', return_url: RETURN_URL },
    capture: true,  // автоматическое подтверждение
    receipt: {  // фискальный чек по 54-ФЗ
      customer: { email: user.email, phone: user.phone },
      items: [{
        description: `Онлайн-занятие: ${class.title}`,
        quantity: 1,
        amount: { value: totalAmount / 100, currency: 'RUB' },
        vat_code: 1,  // без НДС (для самозанятых)
        payment_subject: 'service',
        payment_mode: 'full_payment',
      }],
    },
    metadata: { enrollmentId, classId: class.id, teacherId: teacher.id },
  })

  // === Шаг 5: Сохранить Payment ===
  payment = создатьЗаписьPayment({
    externalId: yukassaPayment.id,
    userId: enrollment.parentId,
    enrollmentId: enrollment.id,
    type: 'class_payment',
    amountKopecks: totalAmount,
    commissionKopecks: platformCommission,
    teacherAmountKopecks: teacherAmount,
    currency: 'RUB',
    status: 'processing',
    metadata: yukassaPayment,
  })

  // === Шаг 6: Начислить реферальный бонус (после успешной оплаты) ===
  // Обрабатывается асинхронно через webhook ЮKassa
  // см. handleYukassaWebhook()

  ВЕРНУТЬ { payment, confirmationUrl: yukassaPayment.confirmation.confirmation_url }


АЛГОРИТМ: handleYukassaWebhook(event: YukassaWebhookEvent)

  ЕСЛИ event.type = 'payment.succeeded':
    payment = найтиPayment(externalId = event.object.id)
    payment.status = 'completed'
    payment.processedAt = СЕЙЧАС

    enrollment = загрузитьЗапись(payment.enrollmentId)
    enrollment.status = 'confirmed'

    // Начислить на баланс преподавателя
    teacher = загрузитьПрофильПреподавателя(payment.metadata.teacherId)
    teacher.balanceKopecks += payment.teacherAmountKopecks
    teacher.totalEarnedKopecks += payment.teacherAmountKopecks

    // Section: увеличить счётчик записавшихся
    section = загрузитьСекцию(enrollment.sectionId)
    section.currentStudents += 1

    // Реферальный бонус пригласившему
    ЕСЛИ этоПерваяОплата(enrollment.parentId):
      referrer = найтиПригласившего(enrollment.parentId)
      ЕСЛИ referrer:
        начислитьРеферальныйБонус(referrer.id, 50_000)  // 500 руб.

    // Отправить уведомления
    отправитьУведомление(enrollment.parentId, 'PAYMENT_SUCCESS', payment)
    отправитьEmail(enrollment.parentId, 'payment_receipt', { receiptUrl: payment.receiptUrl })

  ЕСЛИ event.type = 'payment.canceled':
    payment = найтиPayment(externalId = event.object.id)
    payment.status = 'failed'
    отправитьУведомление(payment.userId, 'PAYMENT_FAILED', payment)
```

### 2.5. Движок геймификации (Gamification Engine)

```
АЛГОРИТМ: processAttendance(childId: UUID, sectionId: UUID) → GamificationResult

КОНСТАНТЫ:
  XP_PER_ATTENDANCE = 10
  XP_STREAK_BONUS = [       // бонус за серию дней
    { days: 3, bonus: 5 },
    { days: 7, bonus: 15 },
    { days: 14, bonus: 30 },
    { days: 30, bonus: 100 },
  ]
  LEVEL_XP_FORMULA = (level) => level * 100  // XP для следующего уровня

  BADGES = [
    { slug: 'first_class', condition: { type: 'attendance_count', threshold: 1 }, xpReward: 20 },
    { slug: 'regular_5', condition: { type: 'attendance_count', threshold: 5 }, xpReward: 30 },
    { slug: 'regular_10', condition: { type: 'attendance_count', threshold: 10 }, xpReward: 50 },
    { slug: 'dedicated_25', condition: { type: 'attendance_count', threshold: 25 }, xpReward: 100 },
    { slug: 'streak_3', condition: { type: 'streak_days', threshold: 3 }, xpReward: 15 },
    { slug: 'streak_7', condition: { type: 'streak_days', threshold: 7 }, xpReward: 30 },
    { slug: 'streak_30', condition: { type: 'streak_days', threshold: 30 }, xpReward: 200 },
    { slug: 'explorer_3', condition: { type: 'categories_count', threshold: 3 }, xpReward: 40 },
    { slug: 'course_complete', condition: { type: 'course_completed', threshold: 1 }, xpReward: 50 },
    { slug: 'reviewer', condition: { type: 'review_count', threshold: 3 }, xpReward: 25 },
    { slug: 'xp_500', condition: { type: 'xp_threshold', threshold: 500 }, xpReward: 0 },
    { slug: 'xp_1000', condition: { type: 'xp_threshold', threshold: 1000 }, xpReward: 0 },
  ]

ВХОДНЫЕ ДАННЫЕ:
  child = загрузитьРебёнка(childId)
  section = загрузитьСекцию(sectionId)

ПРОЦЕСС:
  result = { xpEarned: 0, newBadges: [], levelUp: false, newLevel: child.level }

  // === Шаг 1: Начислить базовый XP ===
  result.xpEarned += XP_PER_ATTENDANCE

  // === Шаг 2: Обновить серию (streak) ===
  lastAttendance = загрузитьПоследнееПосещение(childId)
  ЕСЛИ lastAttendance И (СЕГОДНЯ - lastAttendance.date).дни <= 1:
    child.streakDays += 1
  ИНАЧЕ:
    child.streakDays = 1  // сброс серии

  child.maxStreakDays = МАКС(child.maxStreakDays, child.streakDays)

  // Бонус за серию
  ДЛЯ КАЖДОГО streakBonus В XP_STREAK_BONUS (УБЫВАНИЕ ПО days):
    ЕСЛИ child.streakDays >= streakBonus.days:
      result.xpEarned += streakBonus.bonus
      ПРЕРВАТЬ  // только один бонус — максимальный подходящий

  // === Шаг 3: Обновить XP и уровень ===
  child.xp += result.xpEarned
  xpForNextLevel = LEVEL_XP_FORMULA(child.level + 1)

  ПОКА child.xp >= xpForNextLevel:
    child.level += 1
    child.xp -= xpForNextLevel
    result.levelUp = true
    result.newLevel = child.level
    xpForNextLevel = LEVEL_XP_FORMULA(child.level + 1)

  // === Шаг 4: Проверить бейджи ===
  existingBadges = загрузитьБейджиРебёнка(childId)
  stats = вычислитьСтатистикуРебёнка(childId) // { attendanceCount, categoriesCount, ... }

  ДЛЯ КАЖДОГО badge В BADGES:
    ЕСЛИ badge.slug В existingBadges:
      ПРОПУСТИТЬ

    earned = false
    ВЫБРАТЬ badge.condition.type:
      'attendance_count': earned = stats.attendanceCount >= badge.condition.threshold
      'streak_days': earned = child.streakDays >= badge.condition.threshold
      'categories_count': earned = stats.categoriesCount >= badge.condition.threshold
      'course_completed': earned = stats.coursesCompleted >= badge.condition.threshold
      'review_count': earned = stats.reviewCount >= badge.condition.threshold
      'xp_threshold': earned = (child.xp + child.level * 100) >= badge.condition.threshold

    ЕСЛИ earned:
      создатьChildAchievement(childId, badge.id)
      child.xp += badge.xpReward
      result.xpEarned += badge.xpReward
      result.newBadges.ДОБАВИТЬ(badge)
      отправитьУведомление(child.parentId, 'BADGE_EARNED', { childId, badge })

  // === Шаг 5: Сохранить ===
  сохранитьРебёнка(child)

  ВЕРНУТЬ result
```

### 2.6. Планировщик расписания (Timezone-Aware Availability Scheduler)

```
АЛГОРИТМ: getAvailableSections(classId: UUID, userTimezone: string) → AvailableSection[]

ВХОДНЫЕ ДАННЫЕ:
  class = загрузитьКласс(classId)
  sections = загрузитьСекции(classId, status = 'scheduled', startTime > СЕЙЧАС)
  userTz = userTimezone  // напр. 'Europe/Moscow', 'Asia/Novosibirsk'

ПРОЦЕСС:
  available = []

  ДЛЯ КАЖДОГО section В sections:
    // Пропустить полные секции
    ЕСЛИ section.currentStudents >= section.maxStudents:
      ПРОПУСТИТЬ

    // Конвертировать время в зону пользователя
    localStart = конвертироватьВЧасовойПояс(section.startTime, section.timezone, userTz)
    localEnd = конвертироватьВЧасовойПояс(section.endTime, section.timezone, userTz)

    // Определить день недели и время в зоне пользователя
    dayOfWeek = localStart.dayOfWeek  // 0=ПН, 6=ВС
    timeOfDay = localStart.format('HH:mm')

    available.ДОБАВИТЬ({
      sectionId: section.id,
      title: section.title,
      orderIndex: section.orderIndex,
      startTimeUTC: section.startTime,
      endTimeUTC: section.endTime,
      startTimeLocal: localStart.toISO(),
      endTimeLocal: localEnd.toISO(),
      dayOfWeek: dayOfWeek,
      timeOfDay: timeOfDay,
      timezone: userTz,
      spotsLeft: section.maxStudents - section.currentStudents,
      maxStudents: section.maxStudents,
      isTrial: section.isTrial,
      durationMinutes: class.durationMinutes,
    })

  // Сортировать по дате начала
  СОРТИРОВАТЬ available ПО startTimeUTC ВОЗРАСТАНИЕ

  ВЕРНУТЬ available


АЛГОРИТМ: createRecurringSections(
  classId: UUID,
  pattern: RecurrencePattern
) → Section[]

ТИПЫ:
  RecurrencePattern = {
    daysOfWeek: number[];    // [1, 3, 5] = ПН, СР, ПТ
    startTime: string;       // '16:00' (по timezone преподавателя)
    timezone: string;        // 'Europe/Moscow'
    startDate: string;       // '2026-09-01'
    occurrences: number;     // количество повторений
    skipDates?: string[];    // исключения (праздники и т.д.)
  }

ПРОЦЕСС:
  class = загрузитьКласс(classId)
  sections = []
  currentDate = parseDate(pattern.startDate)
  created = 0

  ПОКА created < pattern.occurrences:
    ЕСЛИ currentDate.dayOfWeek В pattern.daysOfWeek:
      dateStr = currentDate.format('YYYY-MM-DD')

      ЕСЛИ dateStr НЕ В (pattern.skipDates ИЛИ []):
        startDateTime = объединитьДатуИВремя(dateStr, pattern.startTime, pattern.timezone)
        endDateTime = startDateTime + class.durationMinutes минут

        section = создатьСекцию({
          classId: classId,
          orderIndex: created + 1,
          startTime: startDateTime.toUTC(),
          endTime: endDateTime.toUTC(),
          timezone: pattern.timezone,
          maxStudents: class.maxStudents,
          currentStudents: 0,
          status: 'scheduled',
          isTrial: created == 0 И class.hasTrialClass,
        })

        sections.ДОБАВИТЬ(section)
        created += 1

    currentDate = currentDate + 1 день

  ВЕРНУТЬ sections
```

---

## 3. API-контракты (REST)

### 3.1. Аутентификация

```
POST /api/v1/auth/register
  Body: {
    email: string,
    password: string,         // минимум 8 символов, буквы + цифры
    firstName: string,
    lastName: string,
    phone?: string,
    role: 'parent' | 'teacher',
    referralCode?: string,    // код пригласившего
  }
  Response 201: {
    user: User,
    tokens: { accessToken: string, refreshToken: string },
  }
  Errors: 400 (validation), 409 (email already exists)

POST /api/v1/auth/login
  Body: {
    email: string,
    password: string,
  }
  Response 200: {
    user: User,
    tokens: { accessToken: string, refreshToken: string },
  }
  Errors: 401 (invalid credentials), 423 (account locked)

POST /api/v1/auth/oauth/vk
  Body: { code: string, redirectUri: string }
  Response 200: { user: User, tokens: TokenPair, isNewUser: boolean }

POST /api/v1/auth/oauth/yandex
  Body: { code: string, redirectUri: string }
  Response 200: { user: User, tokens: TokenPair, isNewUser: boolean }

POST /api/v1/auth/refresh
  Body: { refreshToken: string }
  Response 200: { accessToken: string, refreshToken: string }
  Errors: 401 (invalid/expired refresh token)

POST /api/v1/auth/logout
  Headers: Authorization: Bearer <accessToken>
  Response 204: (no content)
```

### 3.2. Классы

```
GET /api/v1/classes
  Query: {
    page?: number (default 1),
    limit?: number (default 20, max 100),
    categoryId?: UUID,
    ageMin?: number,
    ageMax?: number,
    priceMin?: number,       // в рублях
    priceMax?: number,
    format?: 'one_time' | 'course',
    hasTrialClass?: boolean,
    teacherId?: UUID,
    sortBy?: 'rating' | 'price_asc' | 'price_desc' | 'newest' | 'popular',
  }
  Response 200: {
    items: ClassListItem[],
    pagination: { page, limit, total, totalPages },
  }

GET /api/v1/classes/:id
  Response 200: {
    class: ClassDetail,       // полные данные включая описание markdown
    teacher: TeacherPreview,  // фото, имя, рейтинг, опыт
    sections: Section[],      // ближайшие доступные секции
    reviews: {
      items: Review[],        // последние 5 отзывов
      averageRating: number,
      total: number,
    },
    similarClasses: ClassListItem[],  // до 4 похожих
  }
  Errors: 404

POST /api/v1/classes
  Headers: Authorization: Bearer <accessToken> (role: teacher)
  Body: {
    title: string,
    description: string,
    categoryId: UUID,
    subcategoryId?: UUID,
    ageMin: number,
    ageMax: number,
    format: ClassFormat,
    durationMinutes: number,
    maxStudents: number,
    priceKopecks: number,
    coursePriceKopecks?: number,
    hasTrialClass: boolean,
    requirements?: string,
    tags: string[],
  }
  Response 201: { class: Class } (status: 'draft')
  Errors: 400, 401, 403

PUT /api/v1/classes/:id
  Headers: Authorization: Bearer <accessToken> (role: teacher, owner)
  Body: (partial — любые поля из POST)
  Response 200: { class: Class }
  Errors: 400, 401, 403, 404

POST /api/v1/classes/:id/submit-for-review
  Headers: Authorization: Bearer <accessToken> (role: teacher, owner)
  Response 200: { class: Class } (status: 'pending_review')
  Errors: 400 (incomplete class), 401, 403

POST /api/v1/classes/:id/upload-cover
  Headers: Authorization: Bearer <accessToken> (role: teacher, owner)
  Body: multipart/form-data { file: image (jpeg/png/webp, <=5MB) }
  Response 200: { coverImageUrl: string }
  Errors: 400 (invalid format/size), 401, 403
```

### 3.3. Секции и записи

```
GET /api/v1/classes/:classId/sections
  Query: { status?: SectionStatus, upcoming?: boolean }
  Response 200: { sections: Section[] }

POST /api/v1/classes/:classId/sections
  Headers: Authorization: Bearer <accessToken> (role: teacher, owner)
  Body: {
    title?: string,
    startTime: ISODateTime,
    endTime: ISODateTime,
    timezone: string,
    maxStudents?: number,
    isTrial?: boolean,
  }
  Response 201: { section: Section }

POST /api/v1/classes/:classId/sections/recurring
  Headers: Authorization: Bearer <accessToken> (role: teacher, owner)
  Body: RecurrencePattern
  Response 201: { sections: Section[], count: number }

POST /api/v1/sections/:id/enroll
  Headers: Authorization: Bearer <accessToken> (role: parent)
  Body: {
    childId: UUID,
    promoCode?: string,
  }
  Response 201: {
    enrollment: Enrollment,
    payment?: {                    // null если пробное (бесплатное)
      confirmationUrl: string,     // URL для перенаправления на ЮKassa
    },
  }
  Errors: 400, 401, 403, 404, 409 (already enrolled), 422 (section full)

DELETE /api/v1/enrollments/:id
  Headers: Authorization: Bearer <accessToken> (role: parent, owner)
  Response 200: {
    enrollment: Enrollment,        // status: 'cancelled'
    refund?: { amountKopecks: number, status: string },
  }
  Errors: 400 (too late to cancel), 401, 403, 404
```

### 3.4. Платежи

```
POST /api/v1/payments/checkout
  Headers: Authorization: Bearer <accessToken> (role: parent)
  Body: {
    enrollmentId: UUID,
    promoCode?: string,
    returnUrl: string,             // куда вернуть после оплаты
  }
  Response 200: {
    payment: Payment,
    confirmationUrl: string,       // URL ЮKassa для перенаправления
  }
  Errors: 400, 401, 404

POST /api/v1/payments/webhook
  Headers: (ЮKassa signature verification)
  Body: YukassaWebhookEvent
  Response 200: { received: true }
  // Внутренне: обновляет статусы Payment, Enrollment, начисляет баланс

GET /api/v1/payments/history
  Headers: Authorization: Bearer <accessToken>
  Query: { page?, limit?, type?: PaymentType }
  Response 200: {
    items: Payment[],
    pagination: { page, limit, total, totalPages },
  }
```

### 3.5. Прогресс и достижения

```
GET /api/v1/children/:id/progress
  Headers: Authorization: Bearer <accessToken> (role: parent, owner)
  Response 200: {
    child: {
      id, firstName, xp, level, streakDays, maxStreakDays,
      xpToNextLevel: number,
      levelProgress: number,       // 0.0-1.0
    },
    enrollments: {
      active: EnrollmentWithClass[],
      completed: EnrollmentWithClass[],
      total: number,
      attendanceRate: number,      // 0.0-1.0
    },
  }
  Errors: 401, 403, 404

GET /api/v1/children/:id/achievements
  Headers: Authorization: Bearer <accessToken> (role: parent, owner)
  Response 200: {
    earned: (Achievement & { earnedAt: ISODateTime })[],
    available: Achievement[],      // ещё не полученные
    totalXpFromBadges: number,
  }
  Errors: 401, 403, 404
```

### 3.6. Отзывы

```
POST /api/v1/reviews
  Headers: Authorization: Bearer <accessToken> (role: parent)
  Body: {
    classId: UUID,
    childId: UUID,
    enrollmentId: UUID,
    rating: number,               // 1-5
    text: string,                 // >=50 символов
  }
  Response 201: { review: Review } (status: 'pending_moderation')
  Errors: 400, 401, 403, 409 (already reviewed)

GET /api/v1/classes/:id/reviews
  Query: { page?, limit?, sortBy?: 'newest' | 'rating_high' | 'rating_low' }
  Response 200: {
    items: ReviewWithParent[],
    averageRating: number,
    ratingDistribution: { 1: number, 2: number, 3: number, 4: number, 5: number },
    pagination: { page, limit, total, totalPages },
  }
```

### 3.7. Преподаватели — финансы

```
GET /api/v1/teachers/:id/earnings
  Headers: Authorization: Bearer <accessToken> (role: teacher, owner)
  Query: { period?: 'week' | 'month' | 'quarter' | 'all' }
  Response 200: {
    balance: {
      availableKopecks: number,    // доступно к выводу
      pendingKopecks: number,      // ожидает подтверждения
      totalEarnedKopecks: number,  // всего заработано
    },
    transactions: {
      items: EarningTransaction[],
      pagination: { page, limit, total, totalPages },
    },
    summary: {
      totalStudents: number,
      totalClasses: number,
      averageRating: number,
      commissionRate: number,      // 0.20
    },
  }

POST /api/v1/teachers/:id/withdraw
  Headers: Authorization: Bearer <accessToken> (role: teacher, owner)
  Body: {
    amountKopecks: number,         // >=100000 (>=1000 руб.)
    bankCard: {
      number: string,             // маскированный после создания
      holderName: string,
    },
  }
  Response 200: {
    withdrawal: Payment,           // type: 'teacher_withdrawal', status: 'processing'
    estimatedArrival: ISODateTime, // ожидаемая дата зачисления
  }
  Errors: 400 (insufficient balance, below minimum), 401, 403
```

### 3.8. Рекомендации и поиск

```
GET /api/v1/recommendations/:childId
  Headers: Authorization: Bearer <accessToken> (role: parent, owner)
  Query: { limit?: number (default 20) }
  Response 200: {
    items: (ClassListItem & { score: number, reason: string })[],
    // reason: 'Совпадает с интересами', 'Похожие ученики записались', и т.д.
  }

GET /api/v1/search
  Query: {
    q: string,                    // поисковый запрос
    page?: number,
    limit?: number,
    categoryId?: UUID,
    ageMin?: number,
    ageMax?: number,
    priceMin?: number,
    priceMax?: number,
    format?: ClassFormat,
    hasTrialClass?: boolean,
    rating?: number,
    sortBy?: 'relevance' | 'rating' | 'price_asc' | 'price_desc' | 'newest',
  }
  Response 200: {
    items: (ClassListItem & { highlights: { title?: string, description?: string } })[],
    total: number,
    took: number,                 // время в ms
    facets: {
      categories: { id: UUID, name: string, count: number }[],
      priceRanges: { label: string, min: number, max: number, count: number }[],
      ageGroups: { label: string, min: number, max: number, count: number }[],
    },
    pagination: { page, limit, total, totalPages },
  }
```

---

## 4. Диаграммы переходов состояний

### 4.1. Жизненный цикл класса (Class)

```
                     преподаватель создаёт
                            │
                            ▼
                        ┌───────┐
                        │ draft │
                        └───┬───┘
                            │ submit_for_review
                            ▼
                    ┌────────────────┐
                    │ pending_review │
                    └───────┬────────┘
                   ┌────────┴────────┐
                   │                 │
              одобрено          отклонено
                   │                 │
                   ▼                 ▼
             ┌───────────┐     ┌───────┐
             │ published │     │ draft │ (с комментарием)
             └─────┬─────┘     └───────┘
                   │
                   │ первая секция началась
                   ▼
            ┌─────────────┐
            │ in_progress │
            └──────┬──────┘
                   │
                   │ все секции завершены
                   ▼
             ┌───────────┐
             │ completed │
             └─────┬─────┘
                   │
                   │ преподаватель архивирует / 90 дней
                   ▼
             ┌──────────┐
             │ archived │
             └──────────┘
```

### 4.2. Жизненный цикл записи (Enrollment)

```
              родитель записывает ребёнка
                        │
                        ▼
                   ┌─────────┐
                   │ pending │ (ожидает оплаты)
                   └────┬────┘
              ┌─────────┼──────────┐
              │         │          │
         оплата     оплата     отмена до
         успешна    неуспешна   оплаты
              │         │          │
              ▼         ▼          ▼
        ┌───────────┐  (pending)  ┌───────────┐
        │ confirmed │  остаётся   │ cancelled │
        └─────┬─────┘             └───────────┘
              │
              │ ребёнок присоединился к занятию
              ▼
          ┌────────┐
          │ active │
          └───┬────┘
              │
         ┌────┴─────┐
         │          │
    занятие     отмена
   завершено    во время
         │          │
         ▼          ▼
   ┌───────────┐  ┌──────────┐
   │ completed │  │ refunded │ (возврат по правилам)
   └───────────┘  └──────────┘
```

### 4.3. Жизненный цикл платежа (Payment)

```
              создание платежа в ЮKassa
                        │
                        ▼
                   ┌─────────┐
                   │ pending │
                   └────┬────┘
                        │
                        │ перенаправление на ЮKassa
                        ▼
                  ┌────────────┐
                  │ processing │
                  └─────┬──────┘
               ┌────────┴────────┐
               │                 │
          webhook:           webhook:
          succeeded          canceled
               │                 │
               ▼                 ▼
         ┌───────────┐     ┌────────┐
         │ completed │     │ failed │
         └─────┬─────┘     └────────┘
               │
               │ запрос возврата
               ▼
       ┌──────────────────────┐
       │ refunded /           │
       │ partially_refunded   │
       └──────────────────────┘
```

### 4.4. Верификация преподавателя (TeacherProfile)

```
          заявка преподавателя
                  │
                  ▼
     ┌──────────────────────┐
     │ pending_verification │
     └──────────┬───────────┘
           ┌────┴─────┐
           │          │
      одобрено    отклонено
           │          │
           ▼          ▼
      ┌──────────┐  ┌──────────┐
      │ verified │  │ rejected │
      └─────┬────┘  └─────┬────┘
            │              │
            │ нарушение    │ повторная заявка
            ▼              ▼
      ┌───────────┐  ┌──────────────────────┐
      │ suspended │  │ pending_verification │
      └───────────┘  └──────────────────────┘
```
