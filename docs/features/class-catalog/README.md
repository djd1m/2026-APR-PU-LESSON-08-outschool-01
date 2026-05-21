# Feature: Каталог занятий

**ID:** class-catalog
**Branch:** feature/003-class-catalog
**Epic:** E2
**Stories:** US-007, US-008, US-009
**Effort:** XL
**Status:** done

## Описание

Полнотекстовый поиск и фильтрация занятий с поддержкой русской морфологии через Elasticsearch. Каталог включает страницу списка с фильтрами по предмету, возрасту, цене, формату и страницу детального просмотра занятия. Реализована курсорная пагинация для эффективной загрузки больших списков.

## Реализованные компоненты

### Backend
- `src/modules/classes/classes.controller.ts` — контроллер каталога и детальной страницы
- `src/modules/classes/classes.service.ts` — бизнес-логика поиска и фильтрации
- `src/modules/classes/classes.search.ts` — интеграция с Elasticsearch
- `src/modules/classes/dto/search-classes.dto.ts` — DTO фильтров и пагинации
- `src/modules/classes/classes.index.ts` — маппинг Elasticsearch индекса с русским анализатором

### Frontend
- `src/pages/CatalogPage.tsx` — страница каталога с боковой панелью фильтров
- `src/pages/ClassDetailPage.tsx` — детальная страница занятия
- `src/components/catalog/ClassCard.tsx` — карточка занятия в списке
- `src/components/catalog/FilterPanel.tsx` — панель фильтров (предмет, возраст, цена, формат)
- `src/components/catalog/SearchBar.tsx` — строка полнотекстового поиска
- `src/components/catalog/SubjectBadge.tsx` — бейдж предмета с цветовым градиентом

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /classes | No | Поиск и фильтрация занятий (query, subject, ageMin, ageMax, priceMin, priceMax, format, cursor, limit) |
| GET | /classes/:id | No | Детальная информация о занятии |
| GET | /classes/subjects | No | Список предметов с количеством занятий |

## Ключевые решения
- Elasticsearch с русским анализатором (morphological stemmer) для корректного поиска по падежам и формам слов
- Курсорная пагинация (cursor-based) вместо offset-based — стабильная производительность при росте данных
- Цветовые градиенты привязаны к предметам (subject-based gradients) для визуальной навигации
- Двойное хранение: PostgreSQL как source of truth, Elasticsearch как поисковый индекс с синхронизацией при публикации
