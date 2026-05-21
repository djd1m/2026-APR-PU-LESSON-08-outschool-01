# Архитектура: Каталог занятий

## Размещение компонентов

```
src/
  modules/
    classes/
      classes.module.ts            # NestJS модуль каталога
      classes.controller.ts        # REST: поиск, деталь, список предметов
      classes.service.ts           # Бизнес-логика: поиск, фильтрация, деталь
      classes.search.ts            # Elasticsearch-клиент: запросы, индексация
      classes.index.ts             # Маппинг ES-индекса с русским анализатором
      dto/
        search-classes.dto.ts      # query, subject, ageMin, ageMax, priceMin, priceMax, format, cursor, limit
    search/
      search.module.ts             # Обертка над ElasticsearchModule
      search.service.ts            # Базовый сервис: index, search, delete, bulk

frontend/src/
  pages/
    CatalogPage.tsx                # Каталог: SearchBar + FilterPanel + ClassCard[]
    ClassDetailPage.tsx            # Детальная страница занятия
  components/
    catalog/
      SearchBar.tsx                # Строка поиска с debounce 300ms
      FilterPanel.tsx              # Боковая панель: предмет, возраст, цена, формат
      ClassCard.tsx                # Карточка: название, учитель, цена, бейдж предмета
      SubjectBadge.tsx             # Бейдж с цветовым градиентом по предмету
      LoadMoreButton.tsx           # Кнопка "Показать еще" (cursor pagination)
      EmptyResults.tsx             # Плейсхолдер "Ничего не найдено"
  hooks/
    useClassSearch.ts              # React Query hook: debounce + infinite scroll
```

## Зависимости модуля

```
ClassesModule
  ├── imports: PrismaModule, SearchModule
  ├── providers: ClassesService, ClassesSearchService
  ├── controllers: ClassesController
  └── exports: ClassesService, ClassesSearchService

SearchModule
  ├── imports: ElasticsearchModule.registerAsync(ES_CONFIG)
  ├── providers: SearchService
  └── exports: SearchService
```

## Маппинг Elasticsearch-индекса

```json
{
  "settings": {
    "analysis": {
      "analyzer": {
        "russian_morphology": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "russian_stemmer", "russian_stop"]
        }
      },
      "filter": {
        "russian_stemmer": { "type": "stemmer", "language": "russian" },
        "russian_stop": { "type": "stop", "stopwords": "_russian_" }
      }
    }
  },
  "mappings": {
    "properties": {
      "title": { "type": "text", "analyzer": "russian_morphology", "fields": { "keyword": { "type": "keyword" } } },
      "description": { "type": "text", "analyzer": "russian_morphology" },
      "subject": { "type": "text", "analyzer": "russian_morphology", "fields": { "keyword": { "type": "keyword" } } },
      "ageMin": { "type": "integer" },
      "ageMax": { "type": "integer" },
      "price": { "type": "integer" },
      "format": { "type": "keyword" },
      "status": { "type": "keyword" },
      "teacher": {
        "properties": {
          "id": { "type": "keyword" },
          "name": { "type": "text" },
          "rating": { "type": "float" },
          "verified": { "type": "boolean" }
        }
      },
      "enrollmentCount": { "type": "integer" },
      "createdAt": { "type": "date" }
    }
  }
}
```

## Диаграмма потока поиска

```
Клиент                  ClassesController       ClassesSearchService       Elasticsearch
  │                           │                        │                       │
  ├─ GET /classes?query=... ─>│                        │                       │
  │                           ├─ search(params) ──────>│                       │
  │                           │                        ├─ buildQuery() ────────│
  │                           │                        ├─ es.search() ────────>│
  │                           │                        │<── hits[] ────────────┤
  │                           │                        ├─ formatResponse() ────│
  │<── { items, cursor } ────┤<─── result ────────────┤                       │
```

## Двойное хранилище

- **PostgreSQL** — source of truth для всех данных занятий (CRUD)
- **Elasticsearch** — поисковый индекс для быстрого поиска и фильтрации
- **Синхронизация** — при переходе статуса в PUBLISHED: `indexClass()`, при переходе из PUBLISHED: `removeFromIndex()`
- **Реиндексация** — скрипт `reindex-classes.ts` для полной перестройки индекса из PostgreSQL

## Границы модуля

- ClassesModule не знает о модерации (это в class-creation)
- SearchModule — переиспользуемый, может индексировать и учителей в будущем
- Frontend использует React Query с infinite scroll для пагинации
- SEO: ClassDetailPage рендерит meta-теги через react-helmet
