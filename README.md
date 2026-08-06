# Белот (1×1)

Онлайн-белот: классический торг, объявы, болты, кошелёк (1 USD = 1 коин), buy-in / рейк 10%.

## Запуск (для друга — одна кнопка)

1. Один раз установите [Node.js LTS](https://nodejs.org) и [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. В корне проекта: `docker compose up -d postgres` (БД на порту **5433**).
3. Один раз настройте сервер:
   ```bash
   cd server
   cp ../.env.example .env   # или используйте уже созданный server/.env
   npm install
   npx prisma migrate deploy
   npm run prisma:seed
   ```
4. Дважды кликните `ЗАПУСК.bat` / `ЗАПУСК.command`.
5. Остановка: `СТОП.bat` / `СТОП.command`.

- Клиент: http://localhost:5173  
- Сервер: http://localhost:3001  
- Health: http://localhost:3001/health  

## Запуск (для разработчика)

```bash
# Postgres
docker compose up -d postgres

# сервер
cd server
npm install
npx prisma migrate dev
npm run prisma:seed
npm run dev

# клиент (из корня)
npm run dev
```

## Auth и кошелёк

- Регистрация / вход по email → JWT access (15m) + refresh (cookie + body).
- `POST /wallet/deposit/mock` `{ "amount": 100 }` — mock-депозит (потом крипта).
- Курс: **1 USD = 1 коин**.
- Посадка за стол списывает **buy-in**; при победе **90% банка** победителю, **10%** house.
- «Играть с ботом» — practice **без** денег.

## Стек

- React + Vite + Tailwind + Motion + Zustand + Socket.IO
- NestJS + Socket.IO + Prisma + PostgreSQL
- Правила: `shared/game`

## Проверки

```bash
npm test
npm run lint
npm run build
```

## Правила матча

- Цель стола: 151 / 301 / 501
- Buy-in стола: 10 / 25 / 50 коинов
- 3 болта — победа
- Реконнект: ~8 с grace после disconnect

## Статус проекта

Что сделано и что осталось — см. [PROGRESS.md](PROGRESS.md).
