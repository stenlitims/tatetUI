/**
 * Утримання фокуса всередині відкритого оверлея + повернення фокуса назад.
 *
 * Пишемо руками, а не беремо focus-trap: залежність заради ~150 рядків не
 * варта того, а головне — жодна готова пастка не вміє того, що описано
 * нижче про телепортовані випадайки.
 *
 * Що робить:
 *   - запам'ятовує елемент, з якого відкрили оверлей, і повертає йому фокус;
 *   - зациклює Tab / Shift+Tab у межах панелі;
 *   - помічає решту прямих дітей <body> як inert + aria-hidden, щоб фон не
 *     ловив фокус і не читався скрінрідером.
 *
 * Вкладеність працює з лічильником на кожен елемент фону: коли поверх
 * drawer'а відкривається modal, її пастка помічає inert'ом і корінь drawer'а
 * теж, а атрибути повертаються лише тоді, коли елемент відпустила ОСТАННЯ
 * пастка, що його тримала. Раніше кожна пастка відновлювала власний знімок
 * атрибутів, і закриття не в порядку LIFO (обидва оверлеї одним кліком,
 * навігація, drawer із модалкою в слоті) лишало корінь застосунку з
 * inert + aria-hidden назавжди: сторінка переставала реагувати на все.
 *
 * Важливий нюанс — телепортовані випадайки. UiSelect і UiMenu рендерять список
 * прямо в <body>, тобто ФОРМАЛЬНО поза панеллю. Тому «фон» визначається не як
 * «усе поза контейнером», а як «те, що ми позначили inert у момент активації»:
 * елементи, які з'явилися пізніше (та сама випадайка), лишаються клікабельними
 * й фокусованими.
 */

import { getCurrentScope, onScopeDispose } from 'vue'

/**
 * `import.meta.client` замінено на перевірку document: бібліотеку копіюють
 * і у Vite-проєкти без Nuxt, де цього прапорця не існує.
 */
const isClient = typeof document !== 'undefined'

interface TrapEntry {
  getContainer: () => HTMLElement | null | undefined;
  /** Елементи фону, які ця пастка тримає прихованими. */
  hidden: HTMLElement[];
  /** Куди повернути фокус після закриття. */
  restoreFocus: HTMLElement | null;
}

/** Хто скільки разів приховав елемент фону і що в нього було до того. */
interface HiddenState {
  count: number;
  inert: string | null;
  ariaHidden: string | null;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
  "details > summary:first-of-type",
].join(",");

const trapStack: TrapEntry[] = [];
const hiddenStates = new Map<HTMLElement, HiddenState>();
let listenersAttached = false;

const isVisible = (element: HTMLElement): boolean =>
  element.getClientRects().length > 0 &&
  window.getComputedStyle(element).visibility !== "hidden";

const getFocusable = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("inert") && isVisible(element)
  );

/** Чи дійде до елемента Tab: не під inert, видимий, без tabindex="-1". */
const isTabbable = (element: HTMLElement): boolean =>
  element.tabIndex >= 0 && !element.closest("[inert]") && isVisible(element);

/** Елементи контейнера в порядку, у якому їх обходить Tab. */
export const getTabbable = (container: ParentNode): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isTabbable);

/**
 * Фокус на елемент, до якого дійшов би Tab ПІСЛЯ `reference`.
 *
 * Потрібно телепортованим панелям (UiPopover, UiMenu, UiHoverCard): у DOM
 * вони стоять у кінці <body>, і нативний Tab з їхнього останнього пункту
 * виводив би фокус за межі сторінки замість елемента, що йде за тригером.
 * `skip` — піддерева, які не рахуються (сама панель).
 */
export function focusNextAfter(
  reference: Element,
  skip: Array<Element | null | undefined> = []
): boolean {
  if (!isClient) return false;
  for (const element of Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))) {
    if (reference.contains(element)) continue;
    if (!(reference.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    if (skip.some((node) => node?.contains(element))) continue;
    if (!isTabbable(element)) continue;
    element.focus();
    return true;
  }
  return false;
}

const topEntry = (): TrapEntry | undefined => trapStack[trapStack.length - 1];

/** Чи належить вузол до фону, який ми самі позначили inert. */
const isInHiddenBackground = (entry: TrapEntry, node: Node | null): boolean =>
  !!node && entry.hidden.some((element) => element.contains(node));

const onKeyDown = (event: KeyboardEvent): void => {
  if (event.key !== "Tab") return;

  const entry = topEntry();
  const container = entry?.getContainer();
  if (!entry || !container) return;

  const active = document.activeElement;
  // Фокус у телепортованій випадайці — не заважаємо їй обробляти Tab самій.
  if (active && !container.contains(active) && !isInHiddenBackground(entry, active)) {
    return;
  }

  const focusable = getFocusable(container);
  if (focusable.length === 0) {
    event.preventDefault();
    container.focus({ preventScroll: true });
    return;
  }

  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const isInside = active ? container.contains(active) : false;

  if (event.shiftKey) {
    if (!isInside || active === first || active === container) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    }
    return;
  }

  if (!isInside || active === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
};

const onFocusIn = (event: FocusEvent): void => {
  const entry = topEntry();
  const container = entry?.getContainer();
  if (!entry || !container) return;

  const target = event.target as Node | null;
  if (!target || container.contains(target)) return;
  // Витягуємо фокус назад лише з того, що ми самі сховали як фон.
  if (!isInHiddenBackground(entry, target)) return;

  const focusable = getFocusable(container);
  (focusable[0] ?? container).focus({ preventScroll: true });
};

const attachListeners = (): void => {
  if (listenersAttached) return;
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("focusin", onFocusIn, true);
  listenersAttached = true;
};

const detachListeners = (): void => {
  if (!listenersAttached) return;
  document.removeEventListener("keydown", onKeyDown, true);
  document.removeEventListener("focusin", onFocusIn, true);
  listenersAttached = false;
};

/** Прямий нащадок <body>, усередині якого лежить панель оверлея. */
const overlayRootOf = (container: HTMLElement): HTMLElement => {
  let node: HTMLElement = container;
  while (node.parentElement && node.parentElement !== document.body) {
    node = node.parentElement;
  }
  return node;
};

const hideBackground = (entry: TrapEntry, container: HTMLElement): void => {
  const ownRoot = overlayRootOf(container);

  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child === ownRoot) continue;
    if (child.hasAttribute("data-overlay-ignore")) continue;
    if (child.tagName === "SCRIPT" || child.tagName === "STYLE") continue;

    const state = hiddenStates.get(child);
    if (state) {
      // Уже прихований іншою пасткою: запам'ятовуємо лише, що тримаємо його
      // теж. Знімок атрибутів у ТОЇ пастки — це і є справжні вихідні значення.
      state.count += 1;
    } else {
      hiddenStates.set(child, {
        count: 1,
        inert: child.getAttribute("inert"),
        ariaHidden: child.getAttribute("aria-hidden"),
      });
      child.setAttribute("inert", "");
      child.setAttribute("aria-hidden", "true");
    }
    entry.hidden.push(child);
  }
};

const restoreBackground = (entry: TrapEntry): void => {
  for (const element of entry.hidden) {
    const state = hiddenStates.get(element);
    if (!state) continue;
    state.count -= 1;
    if (state.count > 0) continue;

    hiddenStates.delete(element);
    if (state.inert === null) element.removeAttribute("inert");
    else element.setAttribute("inert", state.inert);

    if (state.ariaHidden === null) element.removeAttribute("aria-hidden");
    else element.setAttribute("aria-hidden", state.ariaHidden);
  }
  entry.hidden.length = 0;
};

export interface FocusTrapActivateOptions {
  /** CSS-селектор усередині панелі або готовий елемент. */
  initialFocus?: string | HTMLElement | null;
}

export const useFocusTrap = (
  getContainer: () => HTMLElement | null | undefined
) => {
  let entry: TrapEntry | null = null;

  const activate = (options: FocusTrapActivateOptions = {}): void => {
    if (!isClient || entry) return;
    const container = getContainer();
    if (!container) return;

    entry = {
      getContainer,
      hidden: [],
      restoreFocus:
        document.activeElement instanceof HTMLElement ? document.activeElement : null,
    };
    trapStack.push(entry);
    attachListeners();

    // Спочатку фокус, потім inert: інакше inert на предку активного елемента
    // збив би фокус у <body> ще до того, як ми його перенесли.
    let target: HTMLElement | null = null;
    if (typeof options.initialFocus === "string") {
      target = container.querySelector<HTMLElement>(options.initialFocus);
    } else if (options.initialFocus instanceof HTMLElement) {
      target = options.initialFocus;
    }
    // Дефолт — сама панель, а не перший інпут: на мобільних автофокус в
    // інпуті одразу піднімає клавіатуру і з'їдає пів екрана.
    (target ?? container).focus({ preventScroll: true });

    hideBackground(entry, container);
  };

  const deactivate = (): void => {
    if (!isClient || !entry) return;
    const current = entry;
    entry = null;

    restoreBackground(current);

    const index = trapStack.indexOf(current);
    const wasTop = index === trapStack.length - 1;
    if (index > -1) trapStack.splice(index, 1);
    if (trapStack.length === 0) detachListeners();

    if (index > -1 && !wasTop) {
      // Поверх ще відкрита інша пастка — повертати фокус зарано, він украв
      // би його з видимого діалогу. Якщо її власна ціль повернення лежить у
      // нашій панелі (яка зараз зникне), вона успадковує нашу: фокус має
      // повернутися на кнопку, з якої відкрили весь ланцюжок, а не в <body>.
      const above = trapStack[index];
      const container = current.getContainer();
      const orphaned =
        !above?.restoreFocus ||
        !above.restoreFocus.isConnected ||
        !!container?.contains(above.restoreFocus);
      if (above && orphaned) above.restoreFocus = current.restoreFocus;
      return;
    }

    const target = current.restoreFocus;
    if (target && document.contains(target)) {
      target.focus({ preventScroll: true });
    }
  };

  if (getCurrentScope()) onScopeDispose(deactivate);

  return { activate, deactivate };
};
