# Псевдокод: Каталог занятий

## 1. Построитель запросов Elasticsearch

```
FUNCTION buildSearchQuery(params):
    must = []
    filter = []

    // Полнотекстовый поиск с русской морфологией
    IF params.query:
        must.push({
            multi_match: {
                query: params.query,
                fields: ["title^3", "description", "subject^2", "teacher.name"],
                type: "best_fields",
                analyzer: "russian_morphology"
            }
        })

    // Фильтр по предмету
    IF params.subject:
        filter.push({ term: { "subject.keyword": params.subject } })

    // Фильтр по возрасту (пересечение диапазонов)
    IF params.ageMin OR params.ageMax:
        ageFilter = { range: {} }
        IF params.ageMin: ageFilter.range["ageMax"] = { gte: params.ageMin }
        IF params.ageMax: ageFilter.range["ageMin"] = { lte: params.ageMax }
        filter.push(ageFilter)

    // Фильтр по цене
    IF params.priceMin OR params.priceMax:
        priceFilter = { range: { price: {} } }
        IF params.priceMin: priceFilter.range.price.gte = params.priceMin
        IF params.priceMax: priceFilter.range.price.lte = params.priceMax
        filter.push(priceFilter)

    // Фильтр по формату
    IF params.format:
        filter.push({ term: { format: params.format } })

    // Только опубликованные
    filter.push({ term: { status: "PUBLISHED" } })

    RETURN {
        bool: {
            must: must.length > 0 ? must : [{ match_all: {} }],
            filter: filter
        }
    }
```

## 2. Формула ранжирования

```
FUNCTION buildSortAndScore(params):
    IF params.query:
        // Поиск по тексту: релевантность + буст по рейтингу
        RETURN {
            query: {
                function_score: {
                    query: buildSearchQuery(params),
                    functions: [
                        {
                            field_value_factor: {
                                field: "teacher.rating",
                                factor: 0.5,
                                modifier: "log1p",
                                missing: 1
                            }
                        },
                        {
                            field_value_factor: {
                                field: "enrollmentCount",
                                factor: 0.1,
                                modifier: "log1p",
                                missing: 0
                            }
                        }
                    ],
                    score_mode: "sum",
                    boost_mode: "multiply"
                }
            }
        }
    ELSE:
        // Без текста: сортировка по популярности + дате
        RETURN {
            query: buildSearchQuery(params),
            sort: [
                { enrollmentCount: "desc" },
                { createdAt: "desc" }
            ]
        }
```

## 3. Курсорная пагинация

```
FUNCTION searchClasses(params):
    query = buildSortAndScore(params)
    query.size = params.limit || 20

    // Курсор: search_after
    IF params.cursor:
        decoded = base64Decode(params.cursor)  // [score, id]
        query.search_after = JSON.parse(decoded)

    // Добавить tiebreaker для стабильной сортировки
    IF NOT query.sort:
        query.sort = [{ _score: "desc" }, { _id: "asc" }]
    ELSE:
        query.sort.push({ _id: "asc" })

    result = elasticsearch.search("classes", query)

    // Формирование следующего курсора
    items = result.hits.hits.map(hit => ({
        ...hit._source,
        id: hit._id
    }))

    nextCursor = null
    IF items.length == params.limit:
        lastHit = result.hits.hits[items.length - 1]
        nextCursor = base64Encode(JSON.stringify(lastHit.sort))

    RETURN {
        items: items,
        nextCursor: nextCursor,
        total: result.hits.total.value
    }
```

## 4. Индексация занятия в Elasticsearch

```
FUNCTION indexClass(classEntity):
    doc = {
        title: classEntity.title,
        description: classEntity.description,
        subject: classEntity.subject,
        ageMin: classEntity.ageMin,
        ageMax: classEntity.ageMax,
        price: classEntity.price,
        format: classEntity.format,
        status: classEntity.status,
        teacher: {
            id: classEntity.teacher.id,
            name: classEntity.teacher.displayName,
            rating: classEntity.teacher.rating,
            verified: classEntity.teacher.verified
        },
        enrollmentCount: classEntity._count.enrollments,
        createdAt: classEntity.createdAt
    }

    elasticsearch.index("classes", classEntity.id, doc)

FUNCTION removeFromIndex(classId):
    elasticsearch.delete("classes", classId)
```

## API-контракты

| Endpoint | Параметры | Response |
|----------|-----------|----------|
| GET /classes | query?, subject?, ageMin?, ageMax?, priceMin?, priceMax?, format?, cursor?, limit? | `{ items[], nextCursor, total }` |
| GET /classes/:id | - | `{ id, title, description, subject, teacher, schedule, price, format, ageMin, ageMax }` |
| GET /classes/subjects | - | `[{ name, count }]` |
