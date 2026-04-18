/**
 * useNavHistory — generic navigation-history stack.
 *
 * Design goals
 * ─────────────
 * • Each call creates an independent stack (call once for shared, multiple
 *   times for isolated histories — e.g. inspector vs. lens).
 * • Single atomic reducer avoids setState race conditions.
 * • back() / forward() return the new current item synchronously so callers
 *   can immediately trigger side-effects (pan, select, etc.).
 *
 * Usage
 * ─────
 *   const nav = useNavHistory<string>();
 *   nav.push("A.1");          // add item, truncate forward stack
 *   const prev = nav.back();  // returns "previous item" or null
 *   nav.canGoBack             // boolean
 *   nav.peek(-1)              // preview what back() would return
 *   nav.peek(+1)              // preview what forward() would return
 */
import { useReducer, useCallback } from "react";

// ─── State ────────────────────────────────────────────────────────────────────

interface State<T> {
  stack: T[];
  idx:   number;   // -1 = empty
}

type Action<T> =
  | { type: "push";    item: T }
  | { type: "back"               }
  | { type: "forward"            };

const MAX_SIZE = 100;

function makeReducer<T>() {
  return function reducer(state: State<T>, action: Action<T>): State<T> {
    switch (action.type) {
      case "push": {
        // Deduplicate: don't re-push the current item
        if (state.idx >= 0 && state.stack[state.idx] === action.item) return state;
        // Discard any forward entries, append new item
        const next = [...state.stack.slice(0, state.idx + 1), action.item];
        // Cap total size (drop oldest entries from the front)
        const trimmed = next.length > MAX_SIZE ? next.slice(next.length - MAX_SIZE) : next;
        return { stack: trimmed, idx: trimmed.length - 1 };
      }
      case "back":
        return state.idx > 0 ? { ...state, idx: state.idx - 1 } : state;
      case "forward":
        return state.idx < state.stack.length - 1
          ? { ...state, idx: state.idx + 1 }
          : state;
    }
  };
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface NavHistory<T> {
  /** Add item; clears forward stack. No-op if item equals current. */
  push:         (item: T) => void;
  /** Go to previous item. Returns it (for immediate use) or null. */
  back:         () => T | null;
  /** Go to next item. Returns it or null. */
  forward:      () => T | null;
  canGoBack:    boolean;
  canGoForward: boolean;
  current:      T | null;
  /** Preview item at relative offset without changing state.
   *  peek(-1) = what back() would return; peek(+1) = what forward() would. */
  peek:         (offset: number) => T | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNavHistory<T>(): NavHistory<T> {
  const [state, dispatch] = useReducer(makeReducer<T>(), { stack: [], idx: -1 });

  const push = useCallback((item: T) => {
    dispatch({ type: "push", item });
  }, []);

  // Returns the new current synchronously so callers don't have to wait for
  // the re-render.
  const back = useCallback((): T | null => {
    if (state.idx <= 0) return null;
    const target = state.stack[state.idx - 1];
    dispatch({ type: "back" });
    return target;
  }, [state]);

  const forward = useCallback((): T | null => {
    if (state.idx >= state.stack.length - 1) return null;
    const target = state.stack[state.idx + 1];
    dispatch({ type: "forward" });
    return target;
  }, [state]);

  const peek = useCallback((offset: number): T | null => {
    return state.stack[state.idx + offset] ?? null;
  }, [state]);

  return {
    push,
    back,
    forward,
    canGoBack:    state.idx > 0,
    canGoForward: state.idx < state.stack.length - 1,
    current:      state.idx >= 0 ? state.stack[state.idx] : null,
    peek,
  };
}
