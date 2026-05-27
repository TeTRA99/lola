// FR-3 Remember-this-for-me — Charly-run one-time setup flow (E4.x).

import type { Result } from '@/utils/result';

export type CatalogObject = {
  id: number;
  canonical_name: string;       // snake_case_id
  display_name: string;         // Spanish, dad-facing
  description: string | null;
  reference_image_uri: string | null;
};

export type ObjectCatalog = CatalogObject[];

export async function getCatalog(): Promise<ObjectCatalog> {
  throw new Error('not_implemented');
}

export async function addObject(_input: {
  canonical: string;
  display: string;
  description?: string;
  reference_image_uri?: string;
}): Promise<Result<{ id: number }, 'duplicate_canonical' | 'storage_error'>> {
  throw new Error('not_implemented');
}

export async function updateObject(
  _id: number,
  _patch: Partial<Pick<CatalogObject, 'display_name' | 'description' | 'reference_image_uri'>>,
): Promise<Result<void, 'not_found' | 'storage_error'>> {
  throw new Error('not_implemented');
}

export async function removeObject(_id: number): Promise<Result<void, 'not_found' | 'storage_error'>> {
  throw new Error('not_implemented');
}
