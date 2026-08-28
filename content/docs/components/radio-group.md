---
title: RadioGroup
description: Група нативних radio з roving tabindex і навігацією Arrow, Home та End.
component: UiRadioGroup
dependsOn:
  - app/utils/uiFieldStyles.ts
emitDescriptions:
  update:modelValue: Значення обраного варіанта.
  change: Варіант, обраний дією користувача.
status: stable
order: 43
---

## Приклад

::component-preview{name="radio-group-basic" stage="min-h-64"}
::

## API

::component-api
::

## Коли використовувати

Коли користувач має бачити всі 2–7 взаємовиключних варіантів одразу — тариф,
режим доставки або рівень доступу. Нативний `name` забезпечує коректну
серіалізацію форми.

## Коли НЕ використовувати

Для довгого чи динамічного списку краще `UiSelect`. Для незалежних варіантів,
де можна обрати кілька, використовуйте `UiCheckbox`.

## Доступність

Arrow-клавіші змінюють вибір у межах групи, Home та End переходять до першого
й останнього доступного варіанта. Disabled-елементи завжди пропускаються.
Візуальні картки не замінюють нативні radio — вони лишаються єдиними
семантичними контролами.
