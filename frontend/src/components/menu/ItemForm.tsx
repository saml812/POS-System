import { useState, type FormEvent } from "react";
import { useLocale } from "../../context/LocaleContext";
import type { Category, MenuItem } from "../../types";

export type ItemFormValues = {
  name: string;
  itemNumber: string;
  description: string;
  price: number;
  sortOrder: number;
  isAvailable: boolean;
  categoryId: string;
};

type ItemFormProps = {
  id?: string;
  categories: Category[];
  initial?: Partial<MenuItem>;
  defaultCategoryId?: string;
  submitLabel: string;
  hideActions?: boolean;
  onSubmit: (values: ItemFormValues) => Promise<void>;
  onCancel?: () => void;
};

export function ItemForm({
  id,
  categories,
  initial,
  defaultCategoryId,
  submitLabel,
  hideActions = false,
  onSubmit,
  onCancel,
}: ItemFormProps) {
  const { t } = useLocale();
  const [name, setName] = useState(initial?.name ?? "");
  const [itemNumber, setItemNumber] = useState(initial?.itemNumber ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(
    initial?.price !== undefined ? String(initial.price) : "",
  );
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [isAvailable, setIsAvailable] = useState(initial?.isAvailable ?? true);
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "",
  );
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        itemNumber: itemNumber.trim(),
        description: description.trim(),
        price: Number(price),
        sortOrder: Number(sortOrder),
        isAvailable,
        categoryId,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id={id} className="em-form" onSubmit={handleSubmit}>
      <div className="em-form-grid">
        <label className="em-field">
          <span className="em-field-label">{t("menu.itemNumber")}</span>
          <input
            className="em-input"
            value={itemNumber}
            onChange={(e) => setItemNumber(e.target.value)}
            placeholder={t("menu.itemNumberPlaceholder")}
          />
        </label>
        <label className="em-field">
          <span className="em-field-label">{t("menu.name")}</span>
          <input
            className="em-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("menu.namePlaceholder.item")}
            required
          />
        </label>
        <label className="em-field">
          <span className="em-field-label">{t("menu.priceUsd")}</span>
          <input
            className="em-input"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            required
          />
        </label>
        <label className="em-field">
          <span className="em-field-label">{t("common.category")}</span>
          <select
            className="em-input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="em-field">
          <span className="em-field-label">{t("menu.sortOrder")}</span>
          <input
            className="em-input"
            type="number"
            step="1"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            required
          />
        </label>
      </div>
      <label className="em-field em-field-full">
        <span className="em-field-label">{t("menu.description")}</span>
        <textarea
          className="em-input em-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("menu.descPlaceholder")}
          rows={2}
        />
      </label>
      <label className="em-checkbox">
        <input
          type="checkbox"
          checked={isAvailable}
          onChange={(e) => setIsAvailable(e.target.checked)}
        />
        <span>{t("menu.availableLabel")}</span>
      </label>
      {!hideActions ? (
        <div className="em-form-actions">
          <button type="submit" className="btn btn-brand" disabled={busy}>
            {busy ? t("common.saving") : submitLabel}
          </button>
          {onCancel ? (
            <button
              type="button"
              className="btn btn-small"
              disabled={busy}
              onClick={onCancel}
            >
              {t("common.cancel")}
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
