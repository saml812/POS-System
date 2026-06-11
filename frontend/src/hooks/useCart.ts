import { useMemo, useState } from "react";
import type { MenuItem } from "../types";
import { cartLineKey, lineUnitPrice } from "../utils/order";

export type CartLine = {
  key: string;
  menuItemId: string;
  optionIds: string[];
  sizeId: string | null;
  preferences?: string;
  quantity: number;
};

export type ResolvedCartLine = CartLine & {
  item: MenuItem;
  selectedOptions: NonNullable<MenuItem["options"]>;
  selectedSize: NonNullable<MenuItem["sizes"]>[number] | null;
  unitPrice: number;
};

export function useCart(menuItems: MenuItem[]) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [open, setOpen] = useState(false);

  const menuItemMap = useMemo(
    () => new Map(menuItems.map((item) => [item.id, item])),
    [menuItems],
  );

  const resolvedLines = useMemo(
    () =>
      lines
        .map((line) => {
          const item = menuItemMap.get(line.menuItemId);
          if (!item) return null;

          const selectedOptions = (item.options ?? []).filter((option) =>
            line.optionIds.includes(option.id),
          );
          const selectedSize =
            (item.sizes ?? []).find((size) => size.id === line.sizeId) ?? null;

          return {
            ...line,
            item,
            selectedOptions,
            selectedSize,
            unitPrice: lineUnitPrice(item.price, [
              ...(selectedSize ? [selectedSize] : []),
              ...selectedOptions,
            ]),
          };
        })
        .filter((line): line is ResolvedCartLine => line !== null),
    [lines, menuItemMap],
  );

  const total = resolvedLines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );

  const itemCount = resolvedLines.reduce(
    (sum, line) => sum + line.quantity,
    0,
  );

  function add(
    menuItemId: string,
    optionIds: string[],
    sizeId: string | null,
    preferences?: string,
  ) {
    const key = cartLineKey(menuItemId, optionIds, sizeId, preferences);
    setLines((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...current,
        { key, menuItemId, optionIds, sizeId, preferences, quantity: 1 },
      ];
    });
    setOpen(true);
  }

  function changeQuantity(key: string, delta: number) {
    setLines((current) =>
      current
        .map((line) =>
          line.key === key
            ? { ...line, quantity: line.quantity + delta }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function remove(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  function clear() {
    setLines([]);
    setOpen(false);
  }

  return {
    lines: resolvedLines,
    rawLines: lines,
    total,
    itemCount,
    open,
    setOpen,
    add,
    changeQuantity,
    remove,
    clear,
  };
}
