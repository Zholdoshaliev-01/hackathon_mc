# Motion Web × Motion Community Hackathon 2026

Production-ready система регистрации команд на хакатон 10 октября 2026 года. Это не статический макет: публичная форма отправляет данные в FastAPI, регистрация атомарно сохраняется в PostgreSQL, а организаторы работают с заявками через защищённую admin-панель.

## Архитектура

- **Frontend:** Vite, HTML5, CSS3, Vanilla JavaScript. Пошаговая форма, адаптивная landing page и отдельная страница `/admin/`.
- **Backend:** FastAPI, Pydantic, SQLAlchemy 2, Alembic. API разделено на routes, schemas, services, models и core.
- **Database:** PostgreSQL 16. Уникальные телефоны, case-insensitive уникальность названий команд, каскадное удаление.
- **Infrastructure:** Docker Compose и Nginx. Nginx проксирует API, ограничивает частоту регистрации/входа и раздаёт frontend.
- **Admin security:** логин/пароль проверяются только backend. После входа создаётся подписанная JWT-сессия в `HttpOnly`, `SameSite=Strict` cookie; секретов в JavaScript нет.

Регистрация команды выполняется одной транзакцией. При ошибке любого участника команда и остальные участники не сохраняются. Первый из трёх участников назначается капитаном на сервере.

## Структура

```text
.
├── frontend/
│   ├── admin/index.html
│   ├── src/
│   │   ├── styles/
│   │   ├── api.js, form.js, validation.js
│   │   ├── main.js, admin.js, i18n.js
│   ├── index.html, vite.config.js, Dockerfile
├── backend/
│   ├── app/
│   │   ├── api/v1, core, db, models, schemas, services
│   │   └── main.py
│   ├── alembic/versions, alembic.ini
│   ├── requirements.txt, Dockerfile
├── nginx/nginx.conf
├── docker-compose.yml
└── .env.example
```

## Быстрый запуск через Docker

Требуются Docker и Docker Compose.

1. Скопируйте `.env.example` в `.env`.
2. Замените все тестовые значения и создайте пароль администратора (см. ниже).
3. Запустите:

```bash
docker compose up --build -d
```

Миграции автоматически применяются при запуске backend. Сайт доступен по `http://localhost`, admin — `http://localhost/admin/`, API docs в production отключены.

Проверка состояния:

```bash
docker compose ps
docker compose logs -f backend
```

Остановка без удаления данных: `docker compose down`. PostgreSQL хранит данные в volume `postgres_data`.

## Локальная разработка

### Backend

Нужны Python 3.12+ и доступный PostgreSQL.

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Для локального запуска поместите `.env` в `backend/` либо экспортируйте переменные окружения. `DATABASE_URL` должен ссылаться на локальный PostgreSQL, например `postgresql+psycopg://user:password@localhost:5432/hackathon`.

### Frontend

Нужен Node.js 20+ (рекомендуется 22).

```bash
cd frontend
npm install
npm run dev
```

Vite откроет `http://localhost:5173`. Если API доступно не через тот же origin, задайте `VITE_API_BASE_URL=http://localhost:8000/api/v1` перед сборкой и добавьте origin frontend в `BACKEND_CORS_ORIGINS`.

## Миграции

Применить существующие:

```bash
docker compose exec backend alembic upgrade head
```

Создать новую после изменения моделей:

```bash
docker compose exec backend alembic revision --autogenerate -m "описание"
```

Откатить последнюю: `docker compose exec backend alembic downgrade -1`.

## Настройка администратора

Сгенерируйте Argon2-хеш локально после установки backend dependencies:

```bash
python -c "from pwdlib import PasswordHash; print(PasswordHash.recommended().hash(input('Admin password: ')))"
```

Запишите результат в `ADMIN_PASSWORD_HASH` внутри `.env`, а логин — в `ADMIN_USERNAME`. Сам пароль нигде не сохраняется. Для production также задайте `COOKIE_SECURE=true` и используйте только HTTPS.

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | База и credentials PostgreSQL |
| `DATABASE_URL` | Полный SQLAlchemy URL подключения |
| `HTTP_PORT` | Публичный HTTP-порт Nginx, по умолчанию `80` |
| `ENVIRONMENT` | `development` или `production` |
| `LOG_LEVEL` | Уровень backend logging |
| `BACKEND_CORS_ORIGINS` | Разрешённые origins через запятую |
| `JWT_SECRET` | Случайная строка минимум 32 символа |
| `JWT_EXPIRE_MINUTES` | Время жизни admin-сессии |
| `COOKIE_SECURE` | `true` при работе через HTTPS |
| `ADMIN_USERNAME` | Логин организатора |
| `ADMIN_PASSWORD_HASH` | Argon2-хеш пароля, не пароль |
| `REGISTRATION_ENABLED` | `true` для приёма заявок; `false` закрывает регистрацию вручную |
| `REGISTRATION_DEADLINE` | Timezone-aware дедлайн ISO 8601, например `2026-10-10T13:00:00+06:00` |
| `VITE_API_BASE_URL` | Необязательный публичный URL API при отдельном frontend origin |

Случайный JWT secret можно получить командой `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

## API

Публичные endpoints:

- `POST /api/v1/registrations` — создать команду с тремя участниками (`201`).
- `GET /api/v1/registration-status` — серверное время, дедлайн и состояние регистрации.
- `GET /api/v1/registrations/{id}` — получить регистрацию (`200`/`404`).
- `GET /api/v1/health` — health check API и базы.

Admin endpoints требуют действующую HttpOnly-сессию:

- `POST /api/v1/admin/auth/login`, `POST /api/v1/admin/auth/logout`, `GET /api/v1/admin/auth/me`
- `GET /api/v1/admin/teams?q=&organization=`
- `GET /api/v1/admin/teams/{id}`
- `DELETE /api/v1/admin/teams/{id}`
- `GET /api/v1/admin/stats`
- `GET /api/v1/admin/export/csv`

CSV экспортируется кнопкой «Экспорт CSV» в admin-панели в UTF-8 с BOM для корректного открытия кириллицы в Excel.

## Перед production deploy

- Заменить все секреты и пароли; `.env` не коммитить.
- Настроить домен и TLS, затем включить `COOKIE_SECURE=true`.
- Указать точные HTTPS origins в `BACKEND_CORS_ORIGINS`.
- Настроить резервные копии PostgreSQL и мониторинг health endpoints/logs.
- Ограничить сетевой доступ к PostgreSQL (по умолчанию порт наружу не публикуется).
- При необходимости вынести rate limiting в общий Redis для нескольких экземпляров Nginx.
- Выполнить пробную регистрацию и CSV-экспорт на production окружении.
