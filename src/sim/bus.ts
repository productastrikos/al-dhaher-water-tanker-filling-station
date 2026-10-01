/** Tiny event bus (ported from legacy SIAP.on/emit).
 *  Events: "fill:start" | "fill:stop" | "bay:change" | "bay:select" (payload = Bay), "tick" (no payload). */
type Fn = (payload?: any) => void;
const listeners: Record<string, Fn[]> = {};

export const bus = {
  on(evt: string, fn: Fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
    return () => bus.off(evt, fn);
  },
  off(evt: string, fn: Fn) {
    listeners[evt] = (listeners[evt] || []).filter((f) => f !== fn);
  },
  emit(evt: string, payload?: any) {
    (listeners[evt] || []).forEach((fn) => {
      try { fn(payload); } catch (e) { console.error(`[bus:${evt}]`, e); }
    });
  },
};
