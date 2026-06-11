import { useState, type FormEvent, type ReactNode } from "react";
import { useLocale } from "../../context/LocaleContext";
import { formatPriceDelta } from "../../utils/order";

export type Modifier = {
  id: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
  isAvailable: boolean;
};

export type ModifierLabels = {
  title: string;
  desc: string;
  empty: string;
  namePlaceholder: string;
  pricePlaceholder: string;
  available: string;
  add: string;
  confirmDelete: (name: string) => string;
};

type ModifierUpdate = Partial<
  Pick<Modifier, "name" | "priceDelta" | "sortOrder" | "isAvailable">
>;

type ModifierEditorProps = {
  modifiers: Modifier[];
  labels: ModifierLabels;
  busy?: boolean;
  onCreate: (data: {
    name: string;
    priceDelta: number;
    sortOrder: number;
  }) => Promise<void>;
  onUpdate: (id: string, data: ModifierUpdate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

function ModifierField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="em-field em-modifier-field">
      <span className="em-field-label">{label}</span>
      {children}
    </label>
  );
}

export function ModifierEditor({
  modifiers,
  labels,
  busy = false,
  onCreate,
  onUpdate,
  onDelete,
}: ModifierEditorProps) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [priceDelta, setPriceDelta] = useState("0");
  const [sortOrder, setSortOrder] = useState(
    String(
      modifiers.length > 0
        ? Math.max(...modifiers.map((m) => m.sortOrder)) + 1
        : 0,
    ),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPriceDelta, setEditPriceDelta] = useState("0");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        priceDelta: Number(priceDelta),
        sortOrder: Number(sortOrder),
      });
      setName("");
      setPriceDelta("0");
      setSortOrder(String(Number(sortOrder) + 1));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(modifier: Modifier) {
    setEditingId(modifier.id);
    setEditName(modifier.name);
    setEditPriceDelta(String(modifier.priceDelta));
    setEditSortOrder(String(modifier.sortOrder));
  }

  async function saveEdit(modifierId: string) {
    setSaving(true);
    try {
      await onUpdate(modifierId, {
        name: editName.trim(),
        priceDelta: Number(editPriceDelta),
        sortOrder: Number(editSortOrder),
      });
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...modifiers].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );

  return (
    <div className="em-options-editor">
      <div className="em-options-header">
        <h5>{labels.title}</h5>
        <p className="muted">{labels.desc}</p>
      </div>

      {sorted.length === 0 ? (
        <p className="em-options-empty muted">{labels.empty}</p>
      ) : (
        <ul className="em-options-list">
          {sorted.map((modifier) => {
            if (editingId === modifier.id) {
              return (
                <li key={modifier.id} className="em-option-edit">
                  <ModifierField label={t("common.name")}>
                    <input
                      className="em-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={labels.namePlaceholder}
                      required
                    />
                  </ModifierField>
                  <ModifierField label={labels.pricePlaceholder}>
                    <input
                      className="em-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editPriceDelta}
                      onChange={(e) => setEditPriceDelta(e.target.value)}
                    />
                  </ModifierField>
                  <ModifierField label={t("menu.sortOrder")}>
                    <input
                      className="em-input"
                      type="number"
                      step="1"
                      value={editSortOrder}
                      onChange={(e) => setEditSortOrder(e.target.value)}
                    />
                  </ModifierField>
                  <div className="em-option-edit-actions">
                    <button
                      type="button"
                      className="btn btn-small btn-brand"
                      disabled={busy || saving}
                      onClick={() => saveEdit(modifier.id)}
                    >
                      {t("common.save")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={busy || saving}
                      onClick={() => setEditingId(null)}
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </li>
              );
            }

            return (
              <li key={modifier.id} className="em-option-row">
                <input
                  type="checkbox"
                  className="em-option-check"
                  checked={modifier.isAvailable}
                  disabled={busy || saving}
                  aria-label={labels.available}
                  onChange={(e) =>
                    onUpdate(modifier.id, { isAvailable: e.target.checked })
                  }
                />
                <span className="em-option-name">{modifier.name}</span>
                <span className="em-option-price">
                  {formatPriceDelta(modifier.priceDelta)}
                </span>
                <span className="em-option-sort muted">
                  #{modifier.sortOrder}
                </span>
                <div className="em-option-actions">
                  <button
                    type="button"
                    className="em-icon-btn"
                    disabled={busy || saving}
                    onClick={() => startEdit(modifier)}
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    type="button"
                    className="em-icon-btn danger"
                    disabled={busy || saving}
                    onClick={() => {
                      if (confirm(labels.confirmDelete(modifier.name))) {
                        onDelete(modifier.id);
                      }
                    }}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form className="em-option-add" onSubmit={handleCreate}>
        <ModifierField label={t("common.name")}>
          <input
            className="em-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={labels.namePlaceholder}
            required
          />
        </ModifierField>
        <ModifierField label={labels.pricePlaceholder}>
          <input
            className="em-input"
            type="number"
            min="0"
            step="0.01"
            value={priceDelta}
            onChange={(e) => setPriceDelta(e.target.value)}
          />
        </ModifierField>
        <ModifierField label={t("menu.sortOrder")}>
          <input
            className="em-input"
            type="number"
            step="1"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </ModifierField>
        <button type="submit" className="btn btn-brand" disabled={busy || saving}>
          {labels.add}
        </button>
      </form>
    </div>
  );
}
