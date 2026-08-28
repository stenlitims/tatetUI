---
title: Popover
description: SSR-безпечна немодальна панель біля trigger з фліпом, focus return і outside click.
component: UiPopover
dependsOn:
  - app/utils/overlayPosition.ts
emitDescriptions:
  update:modelValue: Панель відкрито або закрито.
  open: Панель відкрилася.
  close: Панель закрилася.
status: stable
order: 44
---

## Приклад

::component-preview{name="popover-basic" stage="min-h-64"}
::

## API

::component-api
::

## Коли використовувати

Для компактних фільтрів, налаштувань і довільних немодальних контролів біля
кнопки. Слот trigger отримує `triggerAttrs` — передайте їх реальному
фокусованому елементу.

## Коли НЕ використовувати

Не використовуйте для критичного підтвердження або довгої форми — беріть
`UiModal` чи `UiDrawer`. Для набору команд із menu-семантикою є `UiMenu`.

## Доступність

Escape закриває панель і повертає фокус. ArrowDown може відкрити її та
сфокусувати перший контроль. `panelRole` дозволяє обрати `dialog`, `group`
або прибрати роль, а `ariaLabel` дає стабільну доступну назву.

Teleport вимкнений на сервері й під час першого client render, тому гідратація
має однакове дерево; перенесення в `body` відбувається після mount.
