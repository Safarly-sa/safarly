/**
 * Favourites — the only place localStorage favourites are touched, same
 * convention as lib/auth.ts for identity. Replaces the old flat
 * `safarly_favorites` (a bare string[] of dish ids, dish-only, no notes, no
 * organisation) with collections + notes, and extends favouriting to POIs
 * (itinerary stops) as well as dishes (Live Lens).
 *
 * Storage is one JSON blob under `safarly_favorites_v2`:
 *   { collections: FavoriteCollection[], items: FavoriteItem[] }
 * A default collection always exists and can't be deleted — every item needs
 * a home, and forcing collection-picking before the first save would be
 * friction for the common case of "just favourite this."
 */

export type FavoriteRefType = "dish" | "poi";

export interface FavoriteCollection {
  id: string;
  name: string;
  createdAt: string;
}

export interface FavoriteItem {
  id: string;
  refType: FavoriteRefType;
  refId: string;
  collectionId: string;
  note: string;
  addedAt: string;
}

interface FavoritesState {
  collections: FavoriteCollection[];
  items: FavoriteItem[];
}

const STORAGE_KEY = "safarly_favorites_v2";
const LEGACY_KEY = "safarly_favorites"; // flat string[] of dish ids, pre-v2
export const DEFAULT_COLLECTION_ID = "default";

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function defaultState(): FavoritesState {
  return {
    collections: [{ id: DEFAULT_COLLECTION_ID, name: "Saved", createdAt: new Date().toISOString() }],
    items: [],
  };
}

/**
 * Reads state, migrating the old flat dish-id array on first read. Migration
 * writes v2 storage but deliberately leaves the legacy key alone — cheap
 * insurance if this code has a bug, nothing is destroyed.
 */
function loadState(): FavoritesState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FavoritesState>;
      if (Array.isArray(parsed.collections) && Array.isArray(parsed.items)) {
        return parsed as FavoritesState;
      }
    }
  } catch { /* fall through to migration/default */ }

  try {
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    const legacyIds: string[] = legacyRaw ? JSON.parse(legacyRaw) : [];
    if (Array.isArray(legacyIds) && legacyIds.length > 0) {
      const state = defaultState();
      const now = new Date().toISOString();
      state.items = [...new Set(legacyIds)].map((dishId) => ({
        id: newId(),
        refType: "dish" as const,
        refId: dishId,
        collectionId: DEFAULT_COLLECTION_ID,
        note: "",
        addedAt: now,
      }));
      saveState(state);
      return state;
    }
  } catch { /* */ }

  return defaultState();
}

function saveState(state: FavoritesState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getFavoritesState(): FavoritesState {
  return loadState();
}

export function listCollections(): FavoriteCollection[] {
  return loadState().collections;
}

export function createCollection(name: string): FavoriteCollection {
  const state = loadState();
  const collection: FavoriteCollection = { id: newId(), name: name.trim() || "Untitled", createdAt: new Date().toISOString() };
  state.collections.push(collection);
  saveState(state);
  return collection;
}

export function renameCollection(collectionId: string, name: string): void {
  const state = loadState();
  const c = state.collections.find((c) => c.id === collectionId);
  if (c && collectionId !== DEFAULT_COLLECTION_ID) c.name = name.trim() || c.name;
  saveState(state);
}

/** The default collection can't be deleted — its items would have nowhere to go. */
export function deleteCollection(collectionId: string): void {
  if (collectionId === DEFAULT_COLLECTION_ID) return;
  const state = loadState();
  state.collections = state.collections.filter((c) => c.id !== collectionId);
  for (const item of state.items) {
    if (item.collectionId === collectionId) item.collectionId = DEFAULT_COLLECTION_ID;
  }
  saveState(state);
}

export function isFavorite(refType: FavoriteRefType, refId: string): boolean {
  return loadState().items.some((i) => i.refType === refType && i.refId === refId);
}

export function findFavorite(refType: FavoriteRefType, refId: string): FavoriteItem | undefined {
  return loadState().items.find((i) => i.refType === refType && i.refId === refId);
}

export function addFavorite(
  refType: FavoriteRefType,
  refId: string,
  collectionId: string = DEFAULT_COLLECTION_ID,
  note = "",
): FavoriteItem {
  const state = loadState();
  const existing = state.items.find((i) => i.refType === refType && i.refId === refId);
  if (existing) return existing;
  const item: FavoriteItem = { id: newId(), refType, refId, collectionId, note, addedAt: new Date().toISOString() };
  state.items.push(item);
  saveState(state);
  return item;
}

export function removeFavorite(refType: FavoriteRefType, refId: string): void {
  const state = loadState();
  state.items = state.items.filter((i) => !(i.refType === refType && i.refId === refId));
  saveState(state);
}

/** Star-toggle convenience for surfaces that don't ask which collection (Live Lens, itinerary stops). */
export function toggleFavorite(refType: FavoriteRefType, refId: string): boolean {
  if (isFavorite(refType, refId)) {
    removeFavorite(refType, refId);
    return false;
  }
  addFavorite(refType, refId);
  return true;
}

export function setNote(itemId: string, note: string): void {
  const state = loadState();
  const item = state.items.find((i) => i.id === itemId);
  if (item) item.note = note;
  saveState(state);
}

export function moveToCollection(itemId: string, collectionId: string): void {
  const state = loadState();
  const item = state.items.find((i) => i.id === itemId);
  if (item) item.collectionId = collectionId;
  saveState(state);
}

export function removeItem(itemId: string): void {
  const state = loadState();
  state.items = state.items.filter((i) => i.id !== itemId);
  saveState(state);
}

export function itemsInCollection(collectionId: string): FavoriteItem[] {
  return loadState().items.filter((i) => i.collectionId === collectionId);
}
