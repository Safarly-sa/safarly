import { describe, it, expect, beforeEach } from "vitest";

/**
 * localStorage doesn't exist in the plain Node test environment this project
 * uses (see vitest.config.ts) — favorites.ts is localStorage-coupled
 * throughout (every call reads/writes it), so tests install a minimal
 * Map-backed polyfill rather than mocking each call individually.
 */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null; }
  setItem(key: string, value: string): void { this.store.set(key, value); }
  removeItem(key: string): void { this.store.delete(key); }
  clear(): void { this.store.clear(); }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

import {
  DEFAULT_COLLECTION_ID,
  addFavorite,
  removeFavorite,
  toggleFavorite,
  isFavorite,
  findFavorite,
  createCollection,
  renameCollection,
  deleteCollection,
  listCollections,
  setNote,
  moveToCollection,
  removeItem,
  itemsInCollection,
  getFavoritesState,
} from "./favorites";

describe("favorites", () => {
  it("starts with a default collection and no items", () => {
    const state = getFavoritesState();
    expect(state.collections).toHaveLength(1);
    expect(state.collections[0].id).toBe(DEFAULT_COLLECTION_ID);
    expect(state.items).toHaveLength(0);
  });

  it("adds a favorite into the default collection when none is specified", () => {
    addFavorite("dish", "kabsa_chicken");
    expect(isFavorite("dish", "kabsa_chicken")).toBe(true);
    expect(findFavorite("dish", "kabsa_chicken")?.collectionId).toBe(DEFAULT_COLLECTION_ID);
  });

  it("is idempotent — adding the same ref twice keeps one item", () => {
    addFavorite("poi", "ruh_masmak");
    addFavorite("poi", "ruh_masmak");
    expect(itemsInCollection(DEFAULT_COLLECTION_ID)).toHaveLength(1);
  });

  it("distinguishes dish and poi favorites with the same ref id", () => {
    addFavorite("dish", "shared_id");
    addFavorite("poi", "shared_id");
    expect(isFavorite("dish", "shared_id")).toBe(true);
    expect(isFavorite("poi", "shared_id")).toBe(true);
    expect(itemsInCollection(DEFAULT_COLLECTION_ID)).toHaveLength(2);
  });

  it("removes a favorite", () => {
    addFavorite("dish", "kabsa_chicken");
    removeFavorite("dish", "kabsa_chicken");
    expect(isFavorite("dish", "kabsa_chicken")).toBe(false);
  });

  it("toggles a favorite on then off", () => {
    expect(toggleFavorite("poi", "ruh_masmak")).toBe(true);
    expect(isFavorite("poi", "ruh_masmak")).toBe(true);
    expect(toggleFavorite("poi", "ruh_masmak")).toBe(false);
    expect(isFavorite("poi", "ruh_masmak")).toBe(false);
  });

  it("creates a named collection and files new favorites into it", () => {
    const trip = createCollection("Riyadh Trip");
    addFavorite("poi", "ruh_masmak", trip.id);
    expect(itemsInCollection(trip.id)).toHaveLength(1);
    expect(itemsInCollection(DEFAULT_COLLECTION_ID)).toHaveLength(0);
  });

  it("renames a non-default collection but leaves the default alone", () => {
    const trip = createCollection("Trip");
    renameCollection(trip.id, "Riyadh 2026");
    expect(listCollections().find(c => c.id === trip.id)?.name).toBe("Riyadh 2026");

    renameCollection(DEFAULT_COLLECTION_ID, "Renamed Default");
    expect(listCollections().find(c => c.id === DEFAULT_COLLECTION_ID)?.name).not.toBe("Renamed Default");
  });

  it("deleting a collection moves its items to the default rather than dropping them", () => {
    const trip = createCollection("Trip");
    addFavorite("poi", "ruh_masmak", trip.id);
    deleteCollection(trip.id);

    expect(listCollections().some(c => c.id === trip.id)).toBe(false);
    expect(isFavorite("poi", "ruh_masmak")).toBe(true);
    expect(findFavorite("poi", "ruh_masmak")?.collectionId).toBe(DEFAULT_COLLECTION_ID);
  });

  it("refuses to delete the default collection", () => {
    deleteCollection(DEFAULT_COLLECTION_ID);
    expect(listCollections().some(c => c.id === DEFAULT_COLLECTION_ID)).toBe(true);
  });

  it("sets and updates a note on a favorite", () => {
    const item = addFavorite("poi", "ruh_masmak");
    setNote(item.id, "Go at sunset");
    expect(findFavorite("poi", "ruh_masmak")?.note).toBe("Go at sunset");
  });

  it("moves an item between collections", () => {
    const a = createCollection("A");
    const b = createCollection("B");
    const item = addFavorite("poi", "ruh_masmak", a.id);
    moveToCollection(item.id, b.id);
    expect(itemsInCollection(a.id)).toHaveLength(0);
    expect(itemsInCollection(b.id)).toHaveLength(1);
  });

  it("removes an item outright", () => {
    const item = addFavorite("dish", "kabsa_chicken");
    removeItem(item.id);
    expect(isFavorite("dish", "kabsa_chicken")).toBe(false);
  });

  it("migrates the legacy flat safarly_favorites array of dish ids on first read", () => {
    localStorage.setItem("safarly_favorites", JSON.stringify(["kabsa_chicken", "jareesh", "kabsa_chicken"]));
    const state = getFavoritesState();
    expect(state.items).toHaveLength(2); // de-duplicated
    expect(isFavorite("dish", "kabsa_chicken")).toBe(true);
    expect(isFavorite("dish", "jareesh")).toBe(true);
    expect(state.items.every(i => i.collectionId === DEFAULT_COLLECTION_ID)).toBe(true);
  });

  it("tolerates corrupt storage by falling back to a fresh default state", () => {
    localStorage.setItem("safarly_favorites_v2", "not json");
    const state = getFavoritesState();
    expect(state.collections).toHaveLength(1);
    expect(state.items).toHaveLength(0);
  });
});
