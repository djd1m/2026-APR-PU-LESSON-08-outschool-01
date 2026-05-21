# Псевдокод: Аутентификация и регистрация

## 1. Регистрация пользователя

```
FUNCTION register(email, password, role):
    // Валидация входных данных
    VALIDATE email IS valid_email
    VALIDATE password MATCHES policy(min=8, upper=1, digit=1, special=1)
    VALIDATE role IN [PARENT, TEACHER]

    // Проверка уникальности
    existing = db.user.findUnique(email)
    IF existing THEN THROW ConflictException("Email уже зарегистрирован")

    // Хеширование пароля
    passwordHash = bcrypt.hash(password, rounds=12)

    // Создание пользователя
    user = db.user.create({
        email, passwordHash, role,
        provider: "LOCAL", providerId: null
    })

    // Генерация токенов
    tokens = generateTokenPair(user)
    RETURN { user: sanitize(user), ...tokens }
```

## 2. Вход по email/паролю

```
FUNCTION login(email, password):
    user = db.user.findUnique(email)
    IF NOT user THEN THROW UnauthorizedException("Неверные учетные данные")

    // Проверка блокировки (brute force protection)
    IF user.failedAttempts >= 5 AND timeSince(user.lastFailedAt) < 15min:
        THROW TooManyRequestsException("Аккаунт временно заблокирован")

    // Верификация пароля
    valid = bcrypt.compare(password, user.passwordHash)
    IF NOT valid:
        db.user.update(user.id, {
            failedAttempts: user.failedAttempts + 1,
            lastFailedAt: NOW()
        })
        THROW UnauthorizedException("Неверные учетные данные")

    // Сброс счетчика при успешном входе
    db.user.update(user.id, { failedAttempts: 0 })

    tokens = generateTokenPair(user)
    RETURN { user: sanitize(user), ...tokens }
```

## 3. Генерация JWT-токенов (RS256)

```
FUNCTION generateTokenPair(user):
    payload = { sub: user.id, role: user.role, email: user.email }

    accessToken = jwt.sign(payload, PRIVATE_KEY, {
        algorithm: "RS256",
        expiresIn: "15m"
    })

    refreshToken = crypto.randomBytes(64).toString("hex")
    refreshTokenHash = sha256(refreshToken)

    db.refreshToken.create({
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: NOW() + 7_DAYS
    })

    RETURN { accessToken, refreshToken }
```

## 4. Обновление токена с ротацией

```
FUNCTION refresh(refreshToken):
    tokenHash = sha256(refreshToken)
    stored = db.refreshToken.findUnique(tokenHash)

    IF NOT stored OR stored.expiresAt < NOW() OR stored.revoked:
        THROW UnauthorizedException("Невалидный refresh-токен")

    // Ротация: отзываем старый, выдаем новый
    db.refreshToken.update(stored.id, { revoked: true })

    user = db.user.findUnique(stored.userId)
    tokens = generateTokenPair(user)
    RETURN tokens
```

## 5. OAuth find-or-create поток

```
FUNCTION oauthCallback(provider, profile):
    // provider = "VK" | "YANDEX"
    // profile = { id, email, displayName, avatar }

    user = db.user.findFirst({
        provider: provider,
        providerId: profile.id
    })

    IF NOT user:
        // Проверка email-конфликта
        IF profile.email:
            existingByEmail = db.user.findUnique(profile.email)
            IF existingByEmail:
                // Привязка OAuth к существующему аккаунту
                user = db.user.update(existingByEmail.id, {
                    provider, providerId: profile.id, avatar: profile.avatar
                })
            ELSE:
                user = db.user.create({
                    email: profile.email,
                    provider, providerId: profile.id,
                    displayName: profile.displayName,
                    avatar: profile.avatar,
                    role: "PARENT"  // по умолчанию
                })
        ELSE:
            user = db.user.create({
                provider, providerId: profile.id,
                displayName: profile.displayName,
                role: "PARENT"
            })

    tokens = generateTokenPair(user)
    RETURN redirect("/auth/callback?" + tokens)
```

## API-контракты

| Endpoint | Request Body | Response |
|----------|-------------|----------|
| POST /auth/register | `{ email, password, role }` | `{ user, accessToken, refreshToken }` |
| POST /auth/login | `{ email, password }` | `{ user, accessToken, refreshToken }` |
| POST /auth/refresh | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| GET /auth/me | - (JWT в header/cookie) | `{ id, email, role, displayName }` |
