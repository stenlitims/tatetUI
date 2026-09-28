---
title: Roadmap компонентів
description: Реалізовані пріоритети UI-компонентів і критерії наступного циклу розвитку бібліотеки.
order: 3
---

Три цикли завершено — усі кандидати реалізовані, мають живі приклади,
API-сторінки та accessibility-контракти. Початкові пріоритети були
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

## Цикл 2 — CRM і адміністративні панелі

Другий цикл закриває те, чого бракувало для побудови CRM: дашборд, картка
запису, стрічка активності й фільтр за періодом.

| Компонент | Для чого | Основа композиції | Складність a11y | Статус |
|---|---|---|---|---|
| [`UiStatCard`](/docs/components/stat-card) | Ключова метрика зі зміною за період | Card + Skeleton | стрілка як символ, скорочене значення | stable |
| [`UiAvatarGroup`](/docs/components/avatar-group) | Учасники запису в один рядок | Avatar | приховані учасники лишаються названими | stable |
| [`UiDescriptionList`](/docs/components/description-list) | Пари «назва — значення» в картці | — | справжні `dl`/`dt`/`dd` | stable |
| [`UiSeparator`](/docs/components/separator) | Межа між секціями | — | декоративний проти смислового | stable |
| [`UiTimeline`](/docs/components/timeline) | Історія запису | — | `<time datetime>`, детермінований пояс | stable |
| [`UiTagInput`](/docs/components/tag-input) | Мітки з вільним вводом | Combobox + Chip | список міток проти listbox, live-region | stable |
| [`UiNumberInput`](/docs/components/number-input) | Кількість, ціна, відсоток | Field styles | `role="spinbutton"`, `aria-valuetext` | stable |
| [`UiSplitButton`](/docs/components/split-button) | Головна дія плюс альтернативи | Button + Menu | `role="group"`, ArrowDown на головній | stable |
| [`UiCalendar`](/docs/components/calendar) | Сітка місяця, діапазони | Roving tabindex | `role="grid"`, повна дата в назві дня | stable |
| [`UiDateRangePicker`](/docs/components/date-range-picker) | Період над таблицею чи звітом | Calendar + anchored panel | один `tabindex="0"` на два місяці | stable |
| [`UiTable`](/docs/components/table) — вибір рядків | Масові дії над записами | Table + Checkbox | ім'я прапорця з назви рядка | stable |

Дати рахуються без бібліотеки дат: уся арифметика — в
`app/utils/calendar.ts`, і кожна нова дата будується конструктором
`new Date(рік, місяць, день)`, а не додаванням мілісекунд. Це не стиль:
`+ 86 400 000` ламає сітку місяця двічі на рік, у ночі переходу на літній і
зимовий час.

## Цикл 3 — те, що продукти пишуть заново

Третій цикл зібрано не з каталогів інших бібліотек, а з кодових баз
продуктів: CRM, CMS, маркетплейсу, чату й дашбордів. Кожен компонент нижче
знайшовся щонайменше у двох із них, написаний окремо й по-різному —
спінер `Loading.vue`, `ProgressRing`, `AdminDirtyBar`, `PageHeader`,
`KpiCard` зі спарклайном, `ImageLightbox`, дзвіночок із лічильником,
групи кнопок у панелях інструментів.

| Компонент | Для чого | Основа композиції | Складність a11y | Статус |
|---|---|---|---|---|
| [`UiFormField`](/docs/components/form-field) | Лейбл, опис і помилка для будь-якого контрола | Field styles | `legend` першою дитиною, один опис | stable |
| [`UiRating`](/docs/components/rating) | Оцінка у відгуку, середня оцінка в картці | Native radio | стрілки без зациклення, зняття оцінки | stable |
| [`UiActionBar`](/docs/components/action-bar) | Масові дії, незбережені зміни | Button | постійний live-регіон, sticky проти fixed | stable |
| [`UiButtonGroup`](/docs/components/button-group) | Зчеплені кнопки панелі інструментів | Button | `group` з назвою, не `toolbar` | stable |
| [`UiPageHeader`](/docs/components/page-header) | Шапка сторінки чи розділу | Breadcrumb + Tabs | рівень заголовка окремо від кегля | stable |
| [`UiSparkline`](/docs/components/sparkline) | Тренд у плитці метрики чи рядку | StatCard | один `role="img"` з підсумком | stable |
| [`UiLightbox`](/docs/components/lightbox) | Фото, відео й сторінки на весь екран — рівня Fancybox | Overlay stack + Carousel gestures + Fullscreen API | пастка фокуса, оголошення кадру, фокус на мініатюру після закриття | stable |
| [`UiSpinner`](/docs/components/spinner) | Очікування без відомої тривалості | — | статус лише з назвою | stable |
| [`UiProgressRing`](/docs/components/progress-ring) | Прогрес у щільному місці | Progress | невизначений стан без `aria-valuenow` | stable |
| [`UiIndicator`](/docs/components/indicator) | Лічильник чи крапка на іконці | Avatar, Button | число в назві кнопки, не в значку | stable |

Разом із циклом у `tokens.css` з'явилась роль `--rating`: зірка оцінки — не
попередження, і бренд має змогу перефарбувати її окремо від статусів.

## Як наступний компонент переходить у роботу

Кандидат піднімається у пріоритеті, якщо повторюється щонайменше у двох
продуктах, має нетривіальний keyboard/ARIA-контракт або стає основою для
кількох наступних компонентів. Реалізація має лишатися copy-first і не
додавати runtime-залежність без окремого задокументованого винятку.
