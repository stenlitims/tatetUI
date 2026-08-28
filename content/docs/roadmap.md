---
title: Roadmap компонентів
description: Реалізовані пріоритети UI-компонентів і критерії наступного циклу розвитку бібліотеки.
order: 3
---

Перший roadmap-цикл завершено — усі 11 кандидатів реалізовані, мають живі
приклади, API-сторінки та accessibility-контракти. Початкові пріоритети були
звірені з каталогами
[Radix Primitives](https://www.radix-ui.com/primitives/docs/components),
[shadcn/ui](https://ui.shadcn.com/docs/components) та
[Headless UI](https://headlessui.com/).

## P0 — основа форм і оверлеїв

| Компонент | Для чого | Основа композиції | Складність a11y | Статус |
|---|---|---|---|---|
| [`UiCheckbox`](/docs/components/checkbox) | Незалежні булеві параметри та множинний вибір | Form groups, Table settings | mixed state, label/error зв'язок | stable |
| [`UiRadioGroup`](/docs/components/radio-group) | Один вибір із 2–7 видимих варіантів | Налаштування, опитування | roving tabindex, Arrow/Home/End | stable |
| [`UiPopover`](/docs/components/popover) | Довільна немодальна панель біля trigger | HoverCard, складені фільтри | focus return, outside click, positioning | stable |

## P1 — продуктові й адміністративні сценарії

| Компонент | Для чого | Основа композиції | Складність a11y | Статус |
|---|---|---|---|---|
| [`UiContextMenu`](/docs/components/context-menu) | Дії над рядком, вузлом або полотном | Menu + positioning | клавіша Context Menu, координати pointer | stable |
| [`UiInputOtp`](/docs/components/input-otp) | Коди підтвердження та 2FA | Input semantics | paste, mobile keyboard, єдине accessible value | stable |
| [`UiNavigationMenu`](/docs/components/navigation-menu) | Ієрархічна продуктова навігація | Popover + links | menubar/navigation semantics, focus | stable |
| [`UiSidebar`](/docs/components/sidebar) | Адаптивна навігація застосунку | Drawer + navigation | collapse state, landmarks, mobile focus | stable |

## P2 — спеціалізовані складені контролі

| Компонент | Для чого | Основа композиції | Складність a11y | Статус |
|---|---|---|---|---|
| [`UiScrollArea`](/docs/components/scroll-area) | Узгоджений scroll affordance | Dropdown, Sidebar, panels | не ламати нативну прокрутку | stable |
| [`UiResizablePanels`](/docs/components/resizable-panels) | Робочі області редакторів і dashboard | Pointer utilities | separator role, клавіатурний resize | stable |
| [`UiCarousel`](/docs/components/carousel) | Послідовність промо або медіа | Buttons + reduced motion | оголошення slide, autoplay controls | stable |
| [`UiHoverCard`](/docs/components/hover-card) | Необов'язковий preview за посиланням | Popover | hover/focus parity, dismiss | stable |

## Як наступний компонент переходить у роботу

Кандидат піднімається у пріоритеті, якщо повторюється щонайменше у двох
продуктах, має нетривіальний keyboard/ARIA-контракт або стає основою для
кількох наступних компонентів. Реалізація має лишатися copy-first і не
додавати runtime-залежність без окремого задокументованого винятку.
