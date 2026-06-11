import type { Dispatch, SetStateAction } from "react";
import type { ModifierInput, ModifierUpdate } from "../api/menu";
import type { Modifier } from "../components/menu/ModifierEditor";

type ModifierApi = {
  create: (itemId: string, data: ModifierInput) => Promise<unknown>;
  update: (id: string, data: ModifierUpdate) => Promise<unknown>;
  delete: (id: string) => Promise<unknown>;
};

type RunAction = (
  action: () => Promise<unknown>,
  successMessage?: string,
) => Promise<void>;

export async function createItemModifiers(
  itemId: string,
  modifiers: Modifier[],
  create: (itemId: string, data: ModifierInput) => Promise<unknown>,
) {
  for (const modifier of modifiers) {
    await create(itemId, {
      name: modifier.name,
      priceDelta: modifier.priceDelta,
      sortOrder: modifier.sortOrder,
      isAvailable: modifier.isAvailable,
    });
  }
}

export function persistedModifierHandlers(
  itemId: string,
  api: ModifierApi,
  messages: { created: string; updated: string; deleted: string },
  runAction: RunAction,
) {
  return {
    onCreate: async (data: {
      name: string;
      priceDelta: number;
      sortOrder: number;
    }) => {
      await runAction(() => api.create(itemId, data), messages.created);
    },
    onUpdate: async (id: string, data: ModifierUpdate) => {
      await runAction(() => api.update(id, data), messages.updated);
    },
    onDelete: async (id: string) => {
      await runAction(() => api.delete(id), messages.deleted);
    },
  };
}

export function draftModifierHandlers(
  setDrafts: Dispatch<SetStateAction<Modifier[]>>,
) {
  return {
    onCreate: async (data: {
      name: string;
      priceDelta: number;
      sortOrder: number;
    }) => {
      setDrafts((current) => [
        ...current,
        { id: crypto.randomUUID(), ...data, isAvailable: true },
      ]);
    },
    onUpdate: async (id: string, data: ModifierUpdate) => {
      setDrafts((current) =>
        current.map((modifier) =>
          modifier.id === id
            ? {
                ...modifier,
                name: data.name ?? modifier.name,
                priceDelta: data.priceDelta ?? modifier.priceDelta,
                sortOrder: data.sortOrder ?? modifier.sortOrder,
                isAvailable: data.isAvailable ?? modifier.isAvailable,
              }
            : modifier,
        ),
      );
    },
    onDelete: async (id: string) => {
      setDrafts((current) => current.filter((modifier) => modifier.id !== id));
    },
  };
}
