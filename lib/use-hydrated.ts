"use client";

import { useSyncExternalStore } from "react";

/**
 * True once the client has hydrated; false during SSR and the hydration render.
 *
 * WHY THIS EXISTS: several components need "don't render the persisted cart until the client
 * takes over", because the server has no access to localStorage and rendering the real value
 * on the server would be a hydration mismatch.
 *
 * The obvious way to express that is `useState(false)` + `useEffect(() => setMounted(true))`,
 * but React 19 flags a synchronous setState inside an effect (react-hooks/set-state-in-effect):
 * it schedules a second render pass for something React can tell us directly.
 *
 * `useSyncExternalStore` answers it with no effect and no state. React uses the SERVER snapshot
 * while rendering on the server and during hydration, then switches to the client snapshot once
 * hydration completes - which is exactly the signal we want.
 *
 * `subscribe` is a no-op because this value changes exactly once, at hydration, and React
 * re-renders at that point anyway.
 */
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
