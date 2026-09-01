---
title: Токени
description: Портативний шар кольорів, радіусів і тіней, спільний для Tailwind v3 і v4.
order: 1
---

Уся палітра живе в одному файлі — `app/assets/css/tokens.css`. Він написаний
чистим CSS без жодного синтаксису Tailwind, тому копіюється у проєкт на v3 і
на v4 без змін.

## Чому кожен колір оголошено двічі

```css
--accent: #1d4ed8;              --accent-rgb: 29, 78, 216;
```

Tailwind v4 бере hex і отримує прозорість нативно через `color-mix()`.
Tailwind v3 так не вміє — йому потрібен триплет, який шим `withOpacity()`
підставляє в `rgba(var(--accent-rgb), <alpha>)`.

Формат саме через **кому**, а не пробіл: у ваших наявних проєктах
`withOpacity()` написаний під комовий формат, тож файл падає до них без
правок їхніх конфігів.

Розбіжність між hex і триплетом ловить `bun run check:docs`.

## Іменування

Токени названі за **роллю**, а не за виглядом. `--radius-card`, а не
`--radius-12`. Інакше «зробимо тут трохи кругліше» розповзається по проєкту
без жодного правила, і за пів року в застосунку сім різних радіусів.

Те саме з кольорами: `--bg-card` замість `--white`. У темній темі картка не
біла, але лишається карткою.

## Пара, яку найчастіше плутають

`--accent` і `--accent-solid` — різні токени навмисно:

- `--accent` (#1d4ed8) — для **тексту та іконок**. На білому дає 6.29:1.
- `--accent-solid` (#2563eb) — для **заливки** кнопки з білим текстом. Дає
  4.56:1, тобто рівно AA.

Один відтінок не може одночасно бути читабельним текстом і достатньо
контрастною заливкою під білим. Спроба обійтися однією змінною закінчується
або блідим текстом, або кнопкою, на якій білий підпис не читається.

## Що змінюється в темній темі, а що ні

`--accent-solid` лишається брендовим і **світлішає** на hover — на темному
тлі це природніший напрямок реакції, ніж потемніння.

Брендова шкала веде себе неочевидно: `700` лишається **темнішим** за `600`,
бо це hover суцільних кнопок із білим текстом. А `800` і `900` навпаки
світлішають, бо вживаються лише як джерело підкладок із прозорістю
(`bg-primary-900/30`) — темний відтінок під 30% прозорості над майже чорним
тлом не дав би нічого видимого.

## Рух

Тривалості й криві — теж токени, з тієї ж причини, що й радіуси: без них
у кожному компоненті власне число (75, 100, 150, 200, 300 мс), і інтерфейс
«дихає» нерівно.

```css
--duration-fast: 120ms;   /* hover, active, зміна кольору */
--duration-base: 180ms;   /* випадайки, підказки, перемикачі */
--duration-slow: 260ms;   /* модалка, drawer, панелі, що їдуть */

--ease-out: cubic-bezier(0.22, 1, 0.36, 1);       /* поява */
--ease-in: cubic-bezier(0.4, 0, 1, 1);            /* зникнення */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
--ease-emphasized: cubic-bezier(0.32, 0.72, 0, 1); /* фізичний рух */
```

У `theme.css` типова `transition` без явного `duration-*` бере `base` +
`ease-out` — тобто кожен `transition-colors` у бібліотеці рухається
однаково. Явні значення потрібні лише там, де роль інша: `ease-emphasized`
для індикатора вкладок і панелі drawer, `duration-fast` для повзунка.

Під `prefers-reduced-motion: reduce` усі тривалості й затримки скидаються
глобально в `main.css`. Затримки — обов'язково: анімація з
`animation-fill-mode: both` тримає елемент невидимим увесь час затримки,
і без скидання каскад «з'являвся б по частинах з паузами».

## Фокус

`--ring` і `--ring-offset` — єдине місце, де задається фокус-кільце. У ваших
чотирьох проєктах воно написане по-різному майже в кожному компоненті
(`focus:ring-primary-500/20`, `outline: 2px solid var(--accent)`, подекуди
просто `focus:outline-none` без заміни). Без єдиного токена контракт
доступності неможливо перевірити автоматично.

`--ring-offset` — це колір **під** елементом. Він відриває кільце від
заливки, інакше на суцільній кнопці кільце зливається з нею.

## Конфіг для Tailwind v3

На v4 реєстрація токенів лежить у `theme.css` (`@theme inline`). Для v3
потрібен еквівалент у `tailwind.config.js`:

```js
const withOpacity = (v) => ({ opacityValue }) =>
  opacityValue === undefined ? `rgb(var(${v}))` : `rgba(var(${v}), ${opacityValue})`

module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: withOpacity('--ink-rgb'),
        muted: withOpacity('--ink-muted-rgb'),
        main: withOpacity('--bg-main-rgb'),
        card: withOpacity('--bg-card-rgb'),
        line: withOpacity('--line-rgb'),
        ring: withOpacity('--ring-rgb'),
        accent: {
          DEFAULT: withOpacity('--accent-rgb'),
          solid: withOpacity('--accent-solid-rgb'),
        },
      },
      borderRadius: {
        control: 'var(--radius-control)',
        card: 'var(--radius-card)',
        overlay: 'var(--radius-overlay)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        raised: 'var(--shadow-raised)',
        overlay: 'var(--shadow-overlay)',
      },
      transitionDuration: {
        DEFAULT: 'var(--duration-base)',
      },
      transitionTimingFunction: {
        DEFAULT: 'var(--ease-out)',
        out: 'var(--ease-out)',
        in: 'var(--ease-in)',
        'in-out': 'var(--ease-in-out)',
        emphasized: 'var(--ease-emphasized)',
      },
    },
  },
}
```

Назви класів після цього однакові в обох версіях, тому скопійований
компонент компілюється без змін.

## Дві речі, які на v3 не працюють

`@utility scrollbar-thin` і `@custom-variant dark` — синтаксис Tailwind v4.
На v3 перенесіть їх у `@layer utilities` і `darkMode: 'class'` відповідно.
