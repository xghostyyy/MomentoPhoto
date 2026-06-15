# Momento — Фотостудия

Fullstack-приложение для управления записями и отзывами фотостудии.

**Стек:** Node.js · Express · SQLite · Vanilla JS

---

## Быстрый старт

### 1. Клонировать / распаковать проект

```
cd "Momento photo"
```

### 2. Установить зависимости

```bash
cd backend
npm install
```

### 3. Настроить окружение

```bash
cp ../.env.example .env
# Отредактируйте .env — укажите JWT_SECRET (обязательно)
```

### 4. Заполнить БД тестовыми данными

```bash
npm run seed
```

### 5. Запустить сервер

```bash
npm start
# или для режима разработки:
npm run dev
```

Откройте **http://localhost:3000** в браузере.

---

## Структура проекта

```
Momento photo/
├── backend/
│   ├── models/          # User, Booking, Review, Service
│   ├── routes/          # index.js — все API-маршруты
│   ├── middleware/       # auth.js — JWT-аутентификация
│   ├── utils/
│   │   └── db.js        # Инициализация SQLite, создание таблиц
│   ├── app.js           # Entry point Express
│   ├── seed.js          # Наполнение таблицы services
│   └── package.json
├── frontend/
│   ├── css/style.css
│   ├── js/main.js
│   └── index.html
└── .env.example
```

---

## API

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET  | /api/test | public | Health check |
| POST | /api/auth/register | public | Регистрация |
| POST | /api/auth/login | public | Вход |
| GET  | /api/services | public | Список услуг |
| POST | /api/bookings | public | Создать заявку |
| GET  | /api/bookings | employee/admin | Все заявки |
| PATCH | /api/bookings/:id/status | employee/admin | Сменить статус |
| GET  | /api/reviews | public | Опубликованные отзывы |
| POST | /api/reviews | public | Оставить отзыв |
| PATCH | /api/reviews/:id/publish | admin | Публикация отзыва |
| GET  | /api/employees | public | Список сотрудников |

### Авторизация

Передавайте JWT в заголовке:

```
Authorization: Bearer <token>
```

---

## Роли

| Роль | Возможности |
|------|-------------|
| `client` | Запись, просмотр услуг и отзывов |
| `employee` | + просмотр и изменение статуса заявок |
| `admin` | + модерация отзывов, полный доступ |
