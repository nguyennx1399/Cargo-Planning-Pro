/**
 * view-prefs-storage.ts — remembered UI preferences (layout choices), in `localStorage`.
 *
 * Every access is wrapped: storage can be missing (node tests, SSR), blocked (private mode, sandboxed
 * previews) or throw on write (quota). A preference is a convenience, so a failure silently falls back
 * to the default and the app keeps working. Values are validated against the allowed set on read, so
 * a hand-edited or stale value can never put the UI in a state it does not know.
 */
const PREFIX = "cpp.";

export function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    return raw !== null && raw !== undefined && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, value);
  } catch {
    // Not remembered this time — the choice still applies for this session.
  }
}
