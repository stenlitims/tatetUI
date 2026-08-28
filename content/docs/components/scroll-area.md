---
title: ScrollArea
description: Нативна scroll-область із edge affordance, подіями меж і програмним API.
component: UiScrollArea
emitDescriptions:
  scroll: Нативна подія прокрутки.
  reachStart: Прокрутка вперше досягла початку.
  reachEnd: Прокрутка вперше досягла кінця.
status: stable
order: 49
---

## Приклад

::component-preview{name="scroll-area-basic" stage="min-h-80"}
::

## API

::component-api
::

## Коли використовувати

Коли частині інтерфейсу потрібна власна вертикальна чи горизонтальна
прокрутка — sidebar, журнал подій, довга панель або таблиця. Компонент додає
лише affordance й події, не замінюючи механізм браузера.

## Коли НЕ використовувати

Не огортайте ним всю сторінку й не створюйте вкладені scroll-контейнери без
необхідності. Для тисяч однотипних рядків використовуйте `UiVirtualList`.

## Доступність

Viewport лишається нативним overflow-контейнером, фокусується клавіатурою і
має іменовану `region`. PageUp, PageDown, Home, End, wheel і touch працюють
без кастомного перехоплення.
