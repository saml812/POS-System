import { apiRequest } from "./client";
import type {
  Category,
  MenuItem,
  MenuItemModifier,
  MenuItemOption,
  MenuItemSize,
} from "../types";

export type ModifierInput = {
  name: string;
  priceDelta?: number;
  sortOrder?: number;
  isAvailable?: boolean;
};

export type ModifierUpdate = Partial<
  Pick<MenuItemModifier, "name" | "priceDelta" | "sortOrder" | "isAvailable">
>;

export function getMenu() {
  return apiRequest<{ categories: (Category & { items: MenuItem[] })[] }>(
    "/menu",
  );
}

export function getMenuAdmin() {
  return apiRequest<{ categories: Category[]; items: MenuItem[] }>(
    "/menu/admin",
  );
}

export function createCategory(data: {
  name: string;
  sortOrder?: number;
  isActive?: boolean;
}) {
  return apiRequest<{ category: Category }>("/menu/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateCategory(
  id: string,
  data: Partial<Pick<Category, "name" | "sortOrder" | "isActive">>,
) {
  return apiRequest<{ category: Category }>(`/menu/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteCategory(id: string) {
  return apiRequest<{ message: string }>(`/menu/categories/${id}`, {
    method: "DELETE",
  });
}

export function createItem(data: {
  name: string;
  price: number;
  categoryId: string;
  itemNumber?: string | null;
  description?: string;
  sortOrder?: number;
  isAvailable?: boolean;
}) {
  return apiRequest<{ item: MenuItem }>("/menu/items", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateItem(
  id: string,
  data: Partial<
    Pick<
      MenuItem,
      | "name"
      | "itemNumber"
      | "description"
      | "price"
      | "sortOrder"
      | "isAvailable"
      | "categoryId"
    >
  >,
) {
  return apiRequest<{ item: MenuItem }>(`/menu/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteItem(id: string) {
  return apiRequest<{ message: string }>(`/menu/items/${id}`, {
    method: "DELETE",
  });
}

export function createItemOption(itemId: string, data: ModifierInput) {
  return apiRequest<{ option: MenuItemOption }>(`/menu/items/${itemId}/options`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateItemOption(id: string, data: ModifierUpdate) {
  return apiRequest<{ option: MenuItemOption }>(`/menu/options/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteItemOption(id: string) {
  return apiRequest<{ message: string }>(`/menu/options/${id}`, {
    method: "DELETE",
  });
}

export function createItemSize(itemId: string, data: ModifierInput) {
  return apiRequest<{ size: MenuItemSize }>(`/menu/items/${itemId}/sizes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateItemSize(id: string, data: ModifierUpdate) {
  return apiRequest<{ size: MenuItemSize }>(`/menu/sizes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteItemSize(id: string) {
  return apiRequest<{ message: string }>(`/menu/sizes/${id}`, {
    method: "DELETE",
  });
}
