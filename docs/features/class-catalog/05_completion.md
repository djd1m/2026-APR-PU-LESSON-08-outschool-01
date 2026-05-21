# Завершение: Каталог занятий

## План тестирования

### Unit-тесты (ClassesSearchService)

| Тест | Описание | Ожидание |
|------|----------|----------|
| build_query_text | Запрос "математика" | multi_match с russian_morphology |
| build_query_filters | subject + age + price | Корректные filter clauses |
| build_query_combined | text + filters | must + filter в bool query |
| build_query_no_params | Пустые параметры | match_all с сортировкой по популярности |
| cursor_pagination | cursor из предыдущего запроса | search_after корректно декодирован |
| cursor_invalid | Невалидный base64 | BadRequestException |
| format_response | ES hits → API response | items[], nextCursor, total |
| index_class | Class entity | Корректный документ отправлен в ES |
| remove_from_index | classId | ES delete вызван |

### Unit-тесты (ClassesService)

| Тест | Описание | Ожидание |
|------|----------|----------|
| find_by_id | Существующее занятие | Полная информация с учителем |
| find_by_id_not_found | Несуществующий id | NotFoundException 404 |
| find_by_id_unpublished | Занятие в DRAFT | NotFoundException (не видно в каталоге) |
| get_subjects | Занятия с разными предметами | Список предметов с count |

### Тесты поисковой точности

| Запрос | Ожидаемый результат | Метрика |
|--------|---------------------|---------|
| "рисование" | Найдены занятия с "рисование", "рисования" | recall > 90% |
| "математика для детей" | Релевантные выше нерелевантных | NDCG > 0.8 |
| "English" | Найдены занятия по английскому | precision > 80% |
| "" (пустой) | Все занятия по популярности | top-10 = самые популярные |

### Интеграционные тесты (endpoints)

| Тест | Метод | Path | Ожидание |
|------|-------|------|----------|
| Search classes | GET | /classes?query=математика | 200, items содержат релевантные |
| Filter by subject | GET | /classes?subject=математика | 200, все items с subject=математика |
| Pagination | GET | /classes?limit=2 → /classes?cursor=... | 200, вторая страница |
| Class detail | GET | /classes/:id | 200, полная информация |
| Class not found | GET | /classes/nonexistent | 404 |
| Subjects list | GET | /classes/subjects | 200, массив {name, count} |

### Тесты производительности

| Сценарий | Метрика | Порог |
|----------|---------|-------|
| Поиск по тексту (10K занятий) | p95 latency | < 500ms |
| Фильтрация без текста | p95 latency | < 300ms |
| Пагинация (страница 100) | p95 latency | < 300ms |
| Детальная страница | p95 latency | < 100ms |

## Деплой

### Elasticsearch

```yaml
# docker-compose.yml (фрагмент)
elasticsearch:
  image: elasticsearch:8.11.0
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=false
    - ES_JAVA_OPTS=-Xms512m -Xmx512m
  volumes:
    - es-data:/usr/share/elasticsearch/data
```

### Переменные окружения

```
ELASTICSEARCH_NODE=http://elasticsearch:9200
ELASTICSEARCH_INDEX_PREFIX=klassmarket
SEARCH_CACHE_TTL=60
```

### Миграции и индексы

- ES-индекс создается автоматически при старте приложения (if not exists)
- Скрипт `reindex-classes.ts` для полной реиндексации из PostgreSQL

## Мониторинг

| Метрика | Тип | Алерт |
|---------|-----|-------|
| search.query.latency_ms | histogram | p95 > 500ms → alert |
| search.query.count | counter | - |
| search.query.empty_results | counter | > 30% → review поисковой релевантности |
| search.index.sync_lag_ms | gauge | > 5000ms → alert |
| elasticsearch.health | gauge | yellow/red → alert |

## Чеклист готовности

- [x] Unit-тесты SearchService (9 кейсов)
- [x] Unit-тесты ClassesService (4 кейса)
- [x] Тесты поисковой точности (4 запроса)
- [x] Интеграционные тесты (6 endpoints)
- [x] Тесты производительности (4 сценария, все < 500ms)
- [x] ES-индекс с русским анализатором настроен
- [x] Circuit breaker для ES-сбоев
- [x] Реиндексация из PostgreSQL работает
