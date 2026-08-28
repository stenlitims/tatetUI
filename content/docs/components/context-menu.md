---
title: ContextMenu
description: Меню дій у координатах pointer із підтримкою Shift+F10 та клавіші Context Menu.
component: UiContextMenu
dependsOn:
  - app/utils/overlayPosition.ts
emitDescriptions:
  update:modelValue: Меню відкрито або закрито.
  open: Меню відкрилося.
  close: Меню закрилося.
status: stable
order: 45
---

## Приклад

::component-preview{name="context-menu-basic" stage="min-h-64"}
::

## API

::component-api
::

## Коли використовувати

Для другорядних дій над файлом, вузлом дерева, рядком таблиці або полотном.
`targetAttrs` мають бути на реальному фокусованому target, щоб клавіатурний
виклик працював поруч із ним.

## Коли НЕ використовувати

Не ховайте тут єдиний шлях до важливої дії. Context menu доповнює видимі
кнопки або `UiMenu`, а не замінює їх.

## Доступність

Shift+F10 та клавіша Context Menu відкривають меню без миші. ArrowUp,
ArrowDown, Home і End переміщують фокус між доступними `menuitem`, Escape
закриває й повертає фокус на target.
