# Псевдокод: Онбординг-квиз

## 1. Машина состояний квиза (frontend)

```
STATES: NAME → AGE → INTERESTS → CONFIRM
TRANSITIONS:
  NAME → AGE:       when name.length > 0
  AGE → INTERESTS:  when age >= 3 AND age <= 18
  INTERESTS → CONFIRM: when interests.length >= 1
  Any → Previous:   always allowed (preserve data)
  Any → SKIP:       redirect to catalog, mark quiz_skipped=true

STATE quizState = {
    currentStep: NAME,
    data: {
        name: "",
        birthDate: null,
        interests: []
    }
}

FUNCTION nextStep(quizState):
    SWITCH quizState.currentStep:
        NAME:
            IF quizState.data.name.trim().length == 0:
                SHOW_ERROR("Введите имя ребенка")
                RETURN quizState
            RETURN { ...quizState, currentStep: AGE }
        AGE:
            age = calculateAge(quizState.data.birthDate)
            IF age < 3 OR age > 18:
                SHOW_ERROR("Возраст должен быть от 3 до 18 лет")
                RETURN quizState
            RETURN { ...quizState, currentStep: INTERESTS }
        INTERESTS:
            IF quizState.data.interests.length == 0:
                SHOW_ERROR("Выберите хотя бы один интерес")
                RETURN quizState
            RETURN { ...quizState, currentStep: CONFIRM }

FUNCTION prevStep(quizState):
    SWITCH quizState.currentStep:
        AGE: RETURN { ...quizState, currentStep: NAME }
        INTERESTS: RETURN { ...quizState, currentStep: AGE }
        CONFIRM: RETURN { ...quizState, currentStep: INTERESTS }
```

## 2. Создание профиля ребенка (backend)

```
FUNCTION createChild(userId, dto):
    // Валидация
    VALIDATE dto.name IS non_empty_string, max 100 chars
    VALIDATE dto.birthDate IS date, age 3-18
    VALIDATE dto.interests IS array[1..10] of known_interest_ids

    // Расчет возраста
    age = calculateAge(dto.birthDate)

    // Создание профиля
    child = db.child.create({
        parentId: userId,
        name: dto.name.trim(),
        birthDate: dto.birthDate,
        interests: dto.interests,
        age: age
    })

    RETURN child
```

## 3. Расчет возраста

```
FUNCTION calculateAge(birthDate):
    today = Date.now()
    age = today.year - birthDate.year
    IF today.month < birthDate.month OR
       (today.month == birthDate.month AND today.day < birthDate.day):
        age = age - 1
    RETURN age
```

## 4. Маппинг интересов для каталога

```
INTERESTS_CATALOG = [
    { id: "math", label: "Математика", icon: "calculator", subjects: ["математика", "логика"] },
    { id: "art", label: "Рисование", icon: "palette", subjects: ["рисование", "живопись"] },
    { id: "music", label: "Музыка", icon: "music-note", subjects: ["музыка", "вокал"] },
    { id: "programming", label: "Программирование", icon: "code", subjects: ["программирование", "робототехника"] },
    { id: "english", label: "Английский", icon: "globe", subjects: ["английский язык"] },
    { id: "science", label: "Наука", icon: "flask", subjects: ["физика", "химия", "биология"] },
    { id: "sports", label: "Спорт", icon: "running", subjects: ["гимнастика", "шахматы", "йога"] },
    { id: "reading", label: "Чтение", icon: "book", subjects: ["литература", "скорочтение"] }
]

FUNCTION mapInterestsToSubjects(childInterests):
    subjects = []
    FOR interest IN childInterests:
        entry = INTERESTS_CATALOG.find(i => i.id == interest)
        IF entry: subjects.addAll(entry.subjects)
    RETURN unique(subjects)
```

## 5. Поток после завершения квиза

```
FUNCTION onQuizComplete(quizData):
    child = await api.post("/users/children", quizData)
    subjects = mapInterestsToSubjects(child.interests)
    navigate("/catalog", { query: { subjects: subjects.join(",") } })
```

## API-контракты

| Endpoint | Request Body | Response |
|----------|-------------|----------|
| POST /users/children | `{ name, birthDate, interests[] }` | `{ id, name, birthDate, interests, age, parentId }` |
| GET /users/children | - | `[{ id, name, birthDate, interests, age }]` |
| GET /interests | - | `[{ id, label, icon }]` |
