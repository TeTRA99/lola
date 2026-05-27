// Substitutes the model's display names for the catalog's display names when
// the canonical matches. Lets dad hear "tu cepillo" instead of "un cepillo".

import type { ObjectCatalog } from '@/services/OnboardingService';
import type { LolaObject } from '@/gateways/openrouter';

export function resolveDisplayName(canonical: string, catalog: ObjectCatalog): string | null {
  return catalog.find(o => o.canonical_name === canonical)?.display_name ?? null;
}

/**
 * Replaces the first occurrence of each model-emitted display name with the
 * catalog's display name when canonicals match. No-op if catalog empty or no
 * canonical hits. First-occurrence-only to avoid clobbering coincidental matches.
 */
export function applyCatalogNarration(
  narration: string,
  objects: LolaObject[],
  catalog: ObjectCatalog,
): string {
  if (catalog.length === 0) return narration;
  let out = narration;
  for (const o of objects) {
    const resolved = resolveDisplayName(o.canonical, catalog);
    if (!resolved || resolved === o.display) continue;
    out = out.replace(o.display, resolved);
  }
  return out;
}
