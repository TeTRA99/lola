// Tiny wrapper so test code can mock `now()` instead of monkey-patching Date.

export const now = (): number => Date.now();
