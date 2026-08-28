---
title: Checkbox
description: Нативний чекбокс із mixed-станом, описом, помилкою та серіалізацією форми.
component: UiCheckbox
dependsOn:
  - app/utils/uiFieldStyles.ts
emitDescriptions:
  update:modelValue: Новий булевий стан.
  change: Новий стан після дії користувача.
status: stable
order: 42
---

## Приклад

::component-preview{name="checkbox-basic" stage="min-h-40"}
::

## API

::component-api
::

## Коли використовувати

Для незалежного булевого параметра, підтвердження умови або множинного
вибору. `indeterminate` показує частково обрану групу, але значення форми
лишається булевим.

## Коли НЕ використовувати

Не використовуйте для налаштування, яке спрацьовує одразу — для цього є
`UiSwitch`. Для одного вибору з кількох взаємовиключних варіантів беріть
`UiRadioGroup`.

## Доступність

Компонент використовує один нативний `<input type="checkbox">`, тому Space,
форми та assistive technologies працюють без емуляції. Mixed-стан передається
одночасно через DOM-властивість `indeterminate` та `aria-checked="mixed"`.

`id` і `name` розділені: перший звʼязує label, другий визначає ключ форми.
