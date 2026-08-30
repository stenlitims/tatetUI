---
title: Sidebar
description: Адаптивна бічна навігація з desktop collapse та mobile focus trap.
component: UiSidebar
dependsOn:
  - app/composables/useFocusTrap.ts
  - app/composables/useReducedMotion.ts
  - app/composables/useScrollLock.ts
  - app/utils/uiSidebar.ts
emitDescriptions:
  update:modelValue: Мобільну панель відкрито або закрито.
  update:collapsed: Desktop-панель згорнуто або розгорнуто — змінено користувачем або прочитано зі сховища.
  close: Мобільну панель закрито.
status: stable
order: 48
---

## Приклад

::component-preview{name="sidebar-basic" stage="min-h-80"}
::

## API

::component-api
::

## Персистентність стану згортання

Передайте `storage-key`, і стан `collapsed` житиме між сесіями — той самий
принцип, що й у `UiResizablePanels`. Значення читається при монтуванні
(щоб не розійшлися server і client рендери) і записується при кожній зміні.
Сховище недоступне (private mode) — персистентність мовчки вимикається,
стан працює в межах сторінки.

## Коли використовувати

Для постійної навігації dashboard, admin або складного продукту. На desktop
панель бере участь у layout і може згортатися; на mobile відкривається поверх
контенту.

## Коли НЕ використовувати

Не використовуйте для тимчасової форми або деталей сутності — це сценарій
`UiDrawer`. На простому сайті з трьома посиланнями достатньо звичайного `nav`.

## Доступність

На mobile панель отримує роль dialog, блокує прокрутку фону, утримує фокус і
закривається через Escape незалежно від того, де зараз фокус. Фокус при
відкритті отримує кнопка закриття (або елемент з `initial-focus`) — не сам
контейнер, тож Tab починається з реальної дії, а не з панелі. На desktop
залишається звичайним `aside` landmark. Кнопка collapse оголошує поточний
стан через `aria-expanded`, а її шеврон вказує в бік, куди панель згорнеться.

## Деталі реалізації

Компонент бере шар зі спільного стеку оверлеїв, тож `UiModal`, відкритий із
сайдбару, завжди поверх. `prefers-reduced-motion` вимикає анімацію панелі й
блюр фону — тривалість Transition задана явно, бо вона керує двома дітьми
(backdrop + панель). Невидима зона дотику кнопок шапки — 45×45 через
`pointer-coarse:after:`. Логіка сховища живе в `app/utils/uiSidebar.ts` —
тестується без рендеру.