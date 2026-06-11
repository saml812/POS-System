import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../context/LocaleContext";
import type { MenuItem } from "../types";
import { formatMoney, formatPriceDelta, lineUnitPrice } from "../utils/order";

type AddToCartModalProps = {
  item: MenuItem;
  onAdd: (
    optionIds: string[],
    sizeId: string | null,
    preferences?: string,
  ) => void;
  onClose: () => void;
};

export function AddToCartModal({ item, onAdd, onClose }: AddToCartModalProps) {
  const { t } = useLocale();
  const options = (item.options ?? []).filter((option) => option.isAvailable);
  const sizes = (item.sizes ?? []).filter((size) => size.isAvailable);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sizeId, setSizeId] = useState<string | null>(
    sizes.length > 0 ? sizes[0].id : null,
  );
  const [preferences, setPreferences] = useState("");

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

  useEffect(() => {
    setSelected(new Set());
    setSizeId(sizes.length > 0 ? sizes[0].id : null);
    setPreferences("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

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

  function handleAdd() {
    if (sizeMissing) return;
    const trimmed = preferences.trim();
    onAdd([...selected], sizeId, trimmed || undefined);
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
        <h3 id="add-item-title">{item.name}</h3>
        {item.description && <p className="dd-item-desc">{item.description}</p>}

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

        <div className="dd-modal-footer">
          <p className="dd-modal-total">
            {t("placeOrder.itemTotal", { amount: formatMoney(unitPrice) })}
          </p>
          <button
            type="button"
            className="btn btn-brand btn-block"
            onClick={handleAdd}
            disabled={sizeMissing}
          >
            {t("common.add")} · {formatMoney(unitPrice)}
          </button>
        </div>
      </div>
    </div>
  );
}
