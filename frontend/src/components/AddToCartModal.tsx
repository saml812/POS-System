import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../context/LocaleContext";
import type { MenuItem, MenuItemOption } from "../types";
import { formatMoney, formatPriceDelta, lineUnitPrice } from "../utils/order";

export type CartItemDraft = {
  optionIds: string[];
  sizeId: string | null;
  preferences?: string;
  quantity: number;
};

type AddToCartModalProps = {
  item: MenuItem;
  mode?: "add" | "edit";
  initial?: CartItemDraft;
  onConfirm: (
    optionIds: string[],
    sizeId: string | null,
    preferences: string | undefined,
    quantity: number,
  ) => void;
  onClose: () => void;
};

type OptionSection = {
  key: string;
  label: string;
  options: MenuItemOption[];
  exclusive: boolean;
};

function defaultOptionIds(itemId: string, options: MenuItemOption[]): string[] {
  const riceOptions = options.filter((option) => option.optionGroup === "rice");
  if (riceOptions.length === 0) return [];

  if (itemId.startsWith("combo-")) {
    const ham = riceOptions.find((option) => option.id === `${itemId}-rice-ham`);
    if (ham) return [ham.id];
  }

  const none = riceOptions.find((option) => option.id === `${itemId}-rice-none`);
  return none ? [none.id] : [];
}

function groupLabel(group: string, t: (key: string) => string): string {
  if (group === "rice") return t("placeOrder.selectRice");
  if (group === "wings") return t("placeOrder.selectWings");
  return t("placeOrder.selectOptions");
}

export function AddToCartModal({
  item,
  mode = "add",
  initial,
  onConfirm,
  onClose,
}: AddToCartModalProps) {
  const { t } = useLocale();
  const options = useMemo(
    () => (item.options ?? []).filter((option) => option.isAvailable),
    [item.options],
  );
  const sizes = useMemo(
    () => (item.sizes ?? []).filter((size) => size.isAvailable),
    [item.sizes],
  );
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        initial?.optionIds ?? defaultOptionIds(item.id, options),
      ),
  );
  const [sizeId, setSizeId] = useState<string | null>(
    initial?.sizeId ?? null,
  );
  const [preferences, setPreferences] = useState(initial?.preferences ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);

  const optionSections = useMemo(() => {
    const sections: OptionSection[] = [];
    const grouped = new Map<string, MenuItemOption[]>();
    const ungrouped: MenuItemOption[] = [];

    for (const option of options) {
      if (option.optionGroup) {
        const group = grouped.get(option.optionGroup) ?? [];
        group.push(option);
        grouped.set(option.optionGroup, group);
      } else {
        ungrouped.push(option);
      }
    }

    const orderedGroups = [...grouped.entries()].sort(([a], [b]) => {
      const order: Record<string, number> = { rice: 0, wings: 1 };
      const rankA = order[a] ?? 99;
      const rankB = order[b] ?? 99;
      if (rankA !== rankB) return rankA - rankB;
      return a.localeCompare(b);
    });

    for (const [group, groupOptions] of orderedGroups) {
      sections.push({
        key: group,
        label: groupLabel(group, t),
        options: groupOptions,
        exclusive: true,
      });
    }

    if (ungrouped.length > 0) {
      sections.push({
        key: "extras",
        label: t("placeOrder.selectExtras"),
        options: ungrouped,
        exclusive: false,
      });
    }

    return sections;
  }, [options, t]);

  useEffect(() => {
    setSelected(
      new Set(
        initial?.optionIds ?? defaultOptionIds(item.id, options),
      ),
    );
    setSizeId(
      initial?.sizeId ?? (sizes.length > 0 ? sizes[0].id : null),
    );
    setPreferences(initial?.preferences ?? "");
    setQuantity(initial?.quantity ?? 1);
  }, [item.id, sizes, initial, options]);

  const selectedOptions = useMemo(
    () => options.filter((option) => selected.has(option.id)),
    [options, selected],
  );

  const selectedSize = useMemo(
    () => sizes.find((size) => size.id === sizeId) ?? null,
    [sizes, sizeId],
  );

  const unitPrice = lineUnitPrice(item.price, [
    ...(selectedSize ? [selectedSize] : []),
    ...selectedOptions,
  ]);

  const lineTotal = unitPrice * quantity;

  function selectExclusiveOption(option: MenuItemOption) {
    const group = option.optionGroup;
    if (!group) return;

    setSelected((current) => {
      const next = new Set(current);
      for (const candidate of options) {
        if (candidate.optionGroup === group) {
          next.delete(candidate.id);
        }
      }
      next.add(option.id);
      return next;
    });
  }

  function toggleOption(optionId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
      }
      return next;
    });
  }

  const sizeMissing = sizes.length > 0 && !sizeId;

  function handleConfirm() {
    if (sizeMissing || quantity < 1) return;
    const trimmed = preferences.trim();
    onConfirm([...selected], sizeId, trimmed || undefined, quantity);
  }

  function renderOptionChip(option: MenuItemOption, exclusive: boolean) {
    const isSelected = selected.has(option.id);
    const priceLabel = formatPriceDelta(option.priceDelta);

    return (
      <button
        key={option.id}
        type="button"
        className={`dd-option-chip ${isSelected ? "selected" : ""}`}
        aria-pressed={isSelected}
        onClick={() =>
          exclusive ? selectExclusiveOption(option) : toggleOption(option.id)
        }
      >
        <span className="dd-option-chip-name">{option.name}</span>
        {priceLabel ? (
          <span className="dd-option-chip-price">{priceLabel}</span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="dd-modal-backdrop" onClick={onClose}>
      <div
        className="dd-modal dd-modal-sheet"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-item-title"
      >
        <button
          type="button"
          className="dd-drawer-close"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          ×
        </button>

        <div className="dd-modal-scroll">
          <h3 id="add-item-title">
            {mode === "edit" ? t("placeOrder.editItemInCart") : item.name}
          </h3>
          {mode === "edit" ? (
            <p className="dd-item-desc muted">{item.name}</p>
          ) : null}
          {item.description && mode === "add" ? (
            <p className="dd-item-desc">{item.description}</p>
          ) : null}

          {sizes.length > 0 ? (
            <section className="dd-modal-section">
              <p className="dd-modal-section-label">{t("placeOrder.selectSize")}</p>
              <div className="dd-option-chip-grid">
                {sizes.map((size) => {
                  const isSelected = sizeId === size.id;
                  return (
                    <button
                      key={size.id}
                      type="button"
                      className={`dd-option-chip ${isSelected ? "selected" : ""}`}
                      aria-pressed={isSelected}
                      onClick={() => setSizeId(size.id)}
                    >
                      <span className="dd-option-chip-name">{size.name}</span>
                      <span className="dd-option-chip-price">
                        {formatPriceDelta(size.priceDelta)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {optionSections.map((section) => (
            <section key={section.key} className="dd-modal-section">
              <p className="dd-modal-section-label">{section.label}</p>
              <div className="dd-option-chip-grid">
                {section.options.map((option) =>
                  renderOptionChip(option, section.exclusive),
                )}
              </div>
            </section>
          ))}

          <label className="dd-preferences-field dd-preferences-compact">
            <span className="dd-preferences-label">{t("placeOrder.preferences")}</span>
            <textarea
              className="dd-preferences-input"
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder={t("placeOrder.preferencesPlaceholder")}
              rows={2}
            />
          </label>
        </div>

        <div className="dd-modal-footer-sticky">
          <div className="dd-modal-qty">
            <span className="dd-modal-qty-label">{t("placeOrder.quantity")}</span>
            <div className="dd-qty-control dd-modal-qty-control">
              <button
                type="button"
                className="dd-qty-btn"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                disabled={quantity <= 1}
                aria-label={t("placeOrder.decreaseQty")}
              >
                −
              </button>
              <span className="dd-qty-value">{quantity}</span>
              <button
                type="button"
                className="dd-qty-btn"
                onClick={() => setQuantity((value) => value + 1)}
                aria-label={t("placeOrder.increaseQty")}
              >
                +
              </button>
            </div>
          </div>

          <p className="dd-modal-total">
            {quantity > 1
              ? t("placeOrder.lineTotal", {
                  amount: formatMoney(lineTotal),
                  each: formatMoney(unitPrice),
                  count: String(quantity),
                })
              : t("placeOrder.itemTotal", { amount: formatMoney(lineTotal) })}
          </p>
          <button
            type="button"
            className="btn btn-brand btn-block"
            onClick={handleConfirm}
            disabled={sizeMissing}
          >
            {mode === "edit"
              ? `${t("common.save")} · ${formatMoney(lineTotal)}`
              : `${t("common.add")} · ${formatMoney(lineTotal)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
