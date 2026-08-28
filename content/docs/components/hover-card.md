---
title: HoverCard
description: Немодальний preview із delay, hover-focus parity та SSR-безпечним Teleport.
component: UiHoverCard
dependsOn:
  - app/utils/overlayPosition.ts
emitDescriptions:
  update:modelValue: Картку показано або приховано.
  open: Картка відкрилася після delay.
  close: Картка закрилася.
status: stable
order: 52
---

## Приклад

::component-preview{name="hover-card-basic" stage="min-h-64"}
::

## API

::component-api
::

## Коли використовувати

Для необовʼязкового preview профілю, посилання, терміна чи сутності без
переходу на окрему сторінку. Вміст має доповнювати, а не бути необхідним для
розуміння trigger.

## Коли НЕ використовувати

Не використовуйте для кнопок дій, обовʼязкової підказки або мобільного-only
сценарію. Для короткої назви є `UiTooltip`, для інтерактивних налаштувань —
`UiPopover`.

## Доступність

Focus відкриває той самий вміст, що й hover. Невелика затримка закриття
дозволяє перевести pointer або focus у телепортовану картку. Escape закриває
її, усі таймери очищаються під час unmount.
