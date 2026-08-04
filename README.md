# Белот (1×1)

Онлайн-белот: классический торг, объявы, болты, анимации раздачи/взятки.

## Запуск

```bash
# терминал 1 — сервер
cd server && npm run dev

# терминал 2 — клиент
npm run dev
```

Откройте две вкладки (разные sessionStorage), введите имена, сядьте за один стол.

- Клиент: http://localhost:5173  
- Сервер: http://localhost:3001

## Стек

- React + Vite + Tailwind + Motion + Zustand + Socket.IO
- NestJS + Socket.IO
- Правила: `shared/game`

## Проверки

```bash
npm test
npm run lint
npm run build
```

## Правила матча

- Цель стола: 151 / 301 / 501 (метка стола)
- 3 болта — победа
- Реконнект: ~8 с grace после disconnect

## Статус проекта

Что сделано и что осталось — см. [PROGRESS.md](PROGRESS.md).
