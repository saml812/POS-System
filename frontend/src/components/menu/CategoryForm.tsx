import { useState, type FormEvent } from "react";
import { useLocale } from "../../context/LocaleContext";
import type { Category } from "../../types";

export type CategoryFormValues = {
  name: string;
  sortOrder: number;
  isActive: boolean;
};

type CategoryFormProps = {
  initial?: Partial<Category>;
  submitLabel: string;
  onSubmit: (values: CategoryFormValues) => Promise<void>;
  onCancel?: () => void;
};

export function CategoryForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: CategoryFormProps) {
  const { t } = useLocale();
  const [name, setName] = useState(initial?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        sortOrder: Number(sortOrder),
        isActive,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="em-form" onSubmit={handleSubmit}>
      <div className="em-form-grid">
        <label className="em-field">
          <span className="em-field-label">{t("menu.name")}</span>
          <input
            className="em-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("menu.namePlaceholder.category")}
            required
          />
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
      <label className="em-checkbox">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        <span>{t("menu.activeLabel")}</span>
      </label>
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
    </form>
  );
}
