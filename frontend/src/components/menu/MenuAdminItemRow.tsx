import { useLocale } from "../../context/LocaleContext";
import type { MenuItem } from "../../types";
import { formatMoney } from "../../utils/order";

type MenuAdminItemRowProps = {
  item: MenuItem;
  busy?: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

export function MenuAdminItemRow({
  item,
  busy = false,
  canEdit,
  onEdit,
  onDelete,
}: MenuAdminItemRowProps) {
  const { t } = useLocale();
  const options = item.options ?? [];

  return (
    <article className={`em-item-card ${!item.isAvailable ? "unavailable" : ""}`}>
      <div className="em-item-main">
        <div className="em-item-head">
          <div className="em-item-title-wrap">
            {item.itemNumber ? (
              <span className="em-item-code">{item.itemNumber}</span>
            ) : null}
            <h4 className="em-item-name">{item.name}</h4>
          </div>
          <span className="em-item-price">{formatMoney(item.price)}</span>
        </div>

        {item.description ? (
          <p className="em-item-desc">{item.description}</p>
        ) : null}

        {options.length > 0 ? (
          <div className="em-item-options">
            {options.map((option) => (
              <span
                key={option.id}
                className={`em-option-chip ${option.isAvailable ? "" : "off"}`}
              >
                {option.name}
              </span>
            ))}
          </div>
        ) : null}

        <div className="em-item-meta">
          <span className="em-meta-pill">
            {t("common.sort")} {item.sortOrder}
          </span>
          <span
            className={`em-status-pill ${item.isAvailable ? "available" : "unavailable"}`}
          >
            {item.isAvailable
              ? t("menu.pillAvailable")
              : t("menu.pillUnavailable")}
          </span>
        </div>
      </div>

      {canEdit ? (
        <div className="em-item-actions">
          <button
            type="button"
            className="em-icon-btn"
            disabled={busy}
            onClick={onEdit}
            title={t("common.edit")}
          >
            {t("common.edit")}
          </button>
          <button
            type="button"
            className="em-icon-btn danger"
            disabled={busy}
            onClick={onDelete}
            title={t("common.delete")}
          >
            {t("common.delete")}
          </button>
        </div>
      ) : null}
    </article>
  );
}
