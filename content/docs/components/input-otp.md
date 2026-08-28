---
title: InputOtp
description: Поле коду підтвердження з одним accessible input, paste і мобільною клавіатурою.
component: UiInputOtp
dependsOn:
  - app/utils/uiFieldStyles.ts
emitDescriptions:
  update:modelValue: Нормалізований код.
  complete: Код досяг заданої довжини.
status: stable
order: 46
---

## Приклад

::component-preview{name="input-otp-basic" stage="min-h-40"}
::

## API

::component-api
::

## Коли використовувати

Для SMS, email і authenticator-кодів. Вставлення заповнює код одним разом,
а `autocomplete="one-time-code"` дозволяє мобільній ОС запропонувати значення.

## Коли НЕ використовувати

Не використовуйте для постійного пароля, PIN-коду платіжної картки або
секрету, який треба зберігати. Компонент не реалізує надсилання чи перевірку
коду — лише введення.

## Доступність

Візуальні клітинки мають `aria-hidden`. Для скрінрідера й форми існує один
справжній input, тому вставлення, виділення та оголошення значення не
розсипаються на шість окремих полів.
