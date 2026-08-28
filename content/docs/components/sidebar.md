---
title: Sidebar
description: Адаптивна бічна навігація з desktop collapse та mobile focus trap.
component: UiSidebar
dependsOn:
  - app/composables/useFocusTrap.ts
  - app/composables/useScrollLock.ts
emitDescriptions:
  update:modelValue: Мобільну панель відкрито або закрито.
  update:collapsed: Desktop-панель згорнуто або розгорнуто.
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

## Коли використовувати

Для постійної навігації dashboard, admin або складного продукту. На desktop
панель бере участь у layout і може згортатися; на mobile відкривається поверх
контенту.

## Коли НЕ використовувати

Не використовуйте для тимчасової форми або деталей сутності — це сценарій
`UiDrawer`. На простому сайті з трьома посиланнями достатньо звичайного `nav`.

## Доступність

На mobile панель отримує роль dialog, блокує прокрутку фону, утримує фокус і
закривається через Escape. На desktop залишається звичайним `aside` landmark.
Кнопка collapse оголошує поточний стан через `aria-expanded`.
