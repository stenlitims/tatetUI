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
 * Вкладеність працює LIFO: коли поверх drawer'а відкривається modal, її пастка
 * помічає inert'ом і корінь drawer'а теж (він тепер справді фон), а при
 * закритті відновлює рівно те, що змінила сама.
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

interface HiddenElement {
  element: HTMLElement;
  inert: string | null;
  ariaHidden: string | null;
}

interface TrapEntry {
  getContainer: () => HTMLElement | null | undefined;
  hidden: HiddenElement[];
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
let listenersAttached = false;

const isVisible = (element: HTMLElement): boolean =>
  element.getClientRects().length > 0 &&
  window.getComputedStyle(element).visibility !== "hidden";

const getFocusable = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("inert") && isVisible(element)
  );

const topEntry = (): TrapEntry | undefined => trapStack[trapStack.length - 1];

/** Чи належить вузол до фону, який ми самі позначили inert. */
const isInHiddenBackground = (entry: TrapEntry, node: Node | null): boolean =>
  !!node && entry.hidden.some(({ element }) => element.contains(node));

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

    entry.hidden.push({
      element: child,
      inert: child.getAttribute("inert"),
      ariaHidden: child.getAttribute("aria-hidden"),
    });
    child.setAttribute("inert", "");
    child.setAttribute("aria-hidden", "true");
  }
};

const restoreBackground = (entry: TrapEntry): void => {
  for (const { element, inert, ariaHidden } of entry.hidden) {
    if (inert === null) element.removeAttribute("inert");
    else element.setAttribute("inert", inert);

    if (ariaHidden === null) element.removeAttribute("aria-hidden");
    else element.setAttribute("aria-hidden", ariaHidden);
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
  let previouslyFocused: HTMLElement | null = null;

  const activate = (options: FocusTrapActivateOptions = {}): void => {
    if (!isClient || entry) return;
    const container = getContainer();
    if (!container) return;

    previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    entry = { getContainer, hidden: [] };
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

    restoreBackground(entry);

    const index = trapStack.indexOf(entry);
    if (index > -1) trapStack.splice(index, 1);
    entry = null;

    if (trapStack.length === 0) detachListeners();

    if (previouslyFocused && document.contains(previouslyFocused)) {
      previouslyFocused.focus({ preventScroll: true });
    }
    previouslyFocused = null;
  };

  if (getCurrentScope()) onScopeDispose(deactivate);

  return { activate, deactivate };
};
