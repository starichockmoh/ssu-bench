# SsuBench

REST API платформа для размещения заданий, откликов исполнителей и перевода виртуальных баллов.

## Стек

- TypeScript
- NestJS
- TypeORM
- PostgreSQL
- Docker Compose
- JWT
- bcrypt

## Ручной запуск

1. Установить зависимости:

```bash
npm install
```

2. Подготовить окружение, если нужно внести коррективы в .env:

```bash
cp .env.example .env
```

3. Запуск БД:

```bash
make up-db
```


4. Применить миграции:

```bash
npm run migration:run
```

5. Запустить проект:

```bash
npm run start:dev
```

## Запуск с Docker

Запуск только базы:

```bash
make up-db
```

Запуск базы и backend:

```bash
make up
```

Остановка:

```bash
make down
```

Остановка с удалением томов:

```bash
make down-clean
```

Сервис будет доступен на `http://localhost:3000`.

## Переменные окружения

См. `.env.example`.

- `PORT` — порт приложения
- `JWT_SECRET` — секрет для JWT
- `JWT_EXPIRES_IN` — время жизни токена
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` — подключение к Postgres
- `HTTP_KEEP_ALIVE_TIMEOUT`, `HTTP_HEADERS_TIMEOUT`, `HTTP_REQUEST_TIMEOUT` — таймауты HTTP-сервера

## Прочие команды

Собрать проект
```bash
npm run build
```

Запуск тестов
```bash
npm run test
```

Применение миграций
```bash
npm run migration:run
```

Откат миграций
```bash
npm run migration:revert
```

Создание миграций
```bash
npm run migration:generate
```

## Примеры curl

Подготовка переменных:

```bash
export BASE_URL=http://localhost:3000
export CUSTOMER_EMAIL=customer@example.com
export ADMIN_EMAIL=admin@example.com
export CONTRACTOR_EMAIL=contractor@example.com
export PASSWORD=password123
```

Регистрация заказчика:

```bash
curl -X POST "$BASE_URL/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{
    \"email\": \"$CUSTOMER_EMAIL\",
    \"password\": \"$PASSWORD\",
    \"role\": \"customer\",
    \"balance\": 200
  }"
```

Регистрация исполнителя:

```bash
curl -X POST "$BASE_URL/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{
    \"email\": \"$CONTRACTOR_EMAIL\",
    \"password\": \"$PASSWORD\",
    \"role\": \"contractor\",
    \"balance\": 0
  }"
```

Регистрация админа:

```bash
curl -X POST "$BASE_URL/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$PASSWORD\",
    \"role\": \"admin\",
    \"balance\": 200
  }"
```

Получение токенов:

```bash
export CUSTOMER_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{
    \"email\": \"$CUSTOMER_EMAIL\",
    \"password\": \"$PASSWORD\"
  }" | node -pe "JSON.parse(fs.readFileSync(0, 'utf8')).access_token")

export CONTRACTOR_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{
    \"email\": \"$CONTRACTOR_EMAIL\",
    \"password\": \"$PASSWORD\"
  }" | node -pe "JSON.parse(fs.readFileSync(0, 'utf8')).access_token")
  
 export ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$PASSWORD\"
  }" | node -pe "JSON.parse(fs.readFileSync(0, 'utf8')).access_token")
```

Создание задачи:

```bash
export TASK_ID=$(curl -s -X POST "$BASE_URL/tasks" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -d '{
    "title": "Подготовить отчёт",
    "description": "Нужно собрать отчёт по результатам тестирования и собрать данные по регрессии",
    "price": 50
  }' | node -pe "JSON.parse(fs.readFileSync(0, 'utf8')).id")
```

Публикация задачи:

```bash
curl -X POST "$BASE_URL/tasks/$TASK_ID/publish" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

Отклик на задачу:

```bash
export BID_ID=$(curl -s -X POST "$BASE_URL/tasks/$TASK_ID/bids" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $CONTRACTOR_TOKEN" \
  -d '{"comment":"Готов выполнить"}' | node -pe "JSON.parse(fs.readFileSync(0, 'utf8')).id")
```

Выбор исполнителя:

```bash
curl -X POST "$BASE_URL/tasks/$TASK_ID/bids/$BID_ID/select" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

Отметка о выполнении:

```bash
curl -X POST "$BASE_URL/tasks/$TASK_ID/complete" \
  -H "Authorization: Bearer $CONTRACTOR_TOKEN"
```

Подтверждение выполнения:

```bash
curl -X POST "$BASE_URL/tasks/$TASK_ID/confirm" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

Проверка результата:

```bash
curl -X GET "$BASE_URL/tasks/$TASK_ID" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"

curl -X GET "$BASE_URL/payments" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

Получение юзеров (только для админа):

```bash
curl -X GET "$BASE_URL/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

curl -X GET "$BASE_URL/users" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

## OpenAPI

Описание API находится в файле `openapi.yaml`.

Развернуть локально (windows):
```bash
docker run -p 8080:8080 `
  -v "${PWD}/openapi.yaml:/var/specs/openapi.yaml" `
  -e SWAGGER_JSON=/var/specs/openapi.yaml `
  swaggerapi/swagger-ui

```

Развернуть локально (Linux):
```bash
docker run -p 8080:8080 \
  -v "$(pwd)/openapi.yaml:/var/specs/openapi.yaml" \
  -e SWAGGER_JSON=/var/specs/openapi.yaml \
  swaggerapi/swagger-ui
```

После чего swagger будет доступен на http://localhost:8080