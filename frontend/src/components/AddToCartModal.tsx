import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../context/LocaleContext";
import type { MenuItem } from "../types";
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
    () => new Set(initial?.optionIds ?? []),
  );
  const [sizeId, setSizeId] = useState<string | null>(
    initial?.sizeId ?? null,
  );
  const [preferences, setPreferences] = useState(initial?.preferences ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);

  useEffect(() => {
    setSelected(new Set(initial?.optionIds ?? []));
    setSizeId(
      initial?.sizeId ?? (sizes.length > 0 ? sizes[0].id : null),
    );
    setPreferences(initial?.preferences ?? "");
    setQuantity(initial?.quantity ?? 1);
  }, [item.id, sizes, initial]);

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

  return (
    <div className="dd-modal-backdrop" onClick={onClose}>
      <div
        className="dd-modal"
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
          <>
            <p className="muted">{t("placeOrder.selectSize")}</p>
            <ul className="dd-option-list">
              {sizes.map((size) => (
                <li key={size.id}>
                  <label
                    className={`dd-option-row ${sizeId === size.id ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="size"
                      className="dd-option-check"
                      checked={sizeId === size.id}
                      onChange={() => setSizeId(size.id)}
                    />
                    <span className="dd-option-name">{size.name}</span>
                    <span className="dd-option-price">
                      {formatPriceDelta(size.priceDelta)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {options.length > 0 ? (
          <>
            <p className="muted">{t("placeOrder.selectOptions")}</p>
            <ul className="dd-option-list">
              {options.map((option) => (
                <li key={option.id}>
                  <label
                    className={`dd-option-row ${selected.has(option.id) ? "selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="dd-option-check"
                      checked={selected.has(option.id)}
                      onChange={() => toggleOption(option.id)}
                    />
                    <span className="dd-option-name">{option.name}</span>
                    <span className="dd-option-price">
                      {formatPriceDelta(option.priceDelta)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <label className="dd-preferences-field">
          <span className="dd-preferences-label">{t("placeOrder.preferences")}</span>
          <textarea
            className="dd-preferences-input"
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            placeholder={t("placeOrder.preferencesPlaceholder")}
            rows={2}
          />
        </label>

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

        <div className="dd-modal-footer">
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
