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
    quantity = 1,
  ) {
    const key = cartLineKey(menuItemId, optionIds, sizeId, preferences);
    const amount = Math.max(1, quantity);
    setLines((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) {
        return current.map((line) =>
          line.key === key
            ? { ...line, quantity: line.quantity + amount }
            : line,
        );
      }
      return [
        ...current,
        {
          key,
          menuItemId,
          optionIds,
          sizeId,
          preferences,
          quantity: amount,
        },
      ];
    });
    setOpen(true);
  }

  function updateLine(
    oldKey: string,
    {
      optionIds,
      sizeId,
      preferences,
      quantity,
    }: {
      optionIds: string[];
      sizeId: string | null;
      preferences?: string;
      quantity: number;
    },
  ) {
    setLines((current) => {
      const oldLine = current.find((line) => line.key === oldKey);
      if (!oldLine) return current;

      const nextQuantity = Math.max(0, quantity);
      if (nextQuantity === 0) {
        return current.filter((line) => line.key !== oldKey);
      }

      const newKey = cartLineKey(
        oldLine.menuItemId,
        optionIds,
        sizeId,
        preferences,
      );

      if (oldKey === newKey) {
        return current.map((line) =>
          line.key === oldKey
            ? {
                ...line,
                optionIds,
                sizeId,
                preferences,
                quantity: nextQuantity,
              }
            : line,
        );
      }

      const withoutOld = current.filter((line) => line.key !== oldKey);
      const existing = withoutOld.find((line) => line.key === newKey);

      if (existing) {
        return withoutOld.map((line) =>
          line.key === newKey
            ? { ...line, quantity: line.quantity + nextQuantity }
            : line,
        );
      }

      return [
        ...withoutOld,
        {
          key: newKey,
          menuItemId: oldLine.menuItemId,
          optionIds,
          sizeId,
          preferences,
          quantity: nextQuantity,
        },
      ];
    });
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
    updateLine,
    remove,
    clear,
  };
}
