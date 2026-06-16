import { useLocale } from "../../context/LocaleContext";
import type { MenuItem } from "../../types";
import { formatMoney } from "../../utils/order";

const CATEGORY_ICONS: Record<string, string> = {
  "chefs-specialties": "👨‍🍳",
  "special-combo": "🍱",
  "appetizers-sides": "🥟",
  soups: "🍲",
  "fried-rice": "🍚",
  "lo-mein": "🍜",
  vegetable: "🥦",
  chicken: "🍗",
  pork: "🥩",
  beef: "🥩",
  shrimp: "🦐",
};

type MenuItemCardProps = {
  item: MenuItem;
  categoryId: string;
  canAdd: boolean;
  onAdd: () => void;
};

export function MenuItemCard({
  item,
  categoryId,
  canAdd,
  onAdd,
}: MenuItemCardProps) {
  const { t } = useLocale();
  const icon = CATEGORY_ICONS[categoryId] ?? "🍽️";
  const hasOptions =
    (item.options?.length ?? 0) > 0 || (item.sizes?.length ?? 0) > 0;

  return (
    <article className="dd-item-card">
      <div className="dd-item-visual" aria-hidden>
        <span className="dd-item-icon">{icon}</span>
      </div>
      <div className="dd-item-body">
        <div className="dd-item-head">
          <h4 className="dd-item-name">
            {item.itemNumber && (
              <span className="dd-item-code">{item.itemNumber}</span>
            )}
            {item.name}
          </h4>
          <span className="dd-item-price">{formatMoney(item.price)}</span>
        </div>
        {item.description && (
          <p className="dd-item-desc">{item.description}</p>
        )}
        {hasOptions && (
          <p className="dd-item-customizable">{t("placeOrder.customizable")}</p>
        )}
      </div>
      {canAdd && (
        <button
          type="button"
          className="dd-add-btn"
          aria-label={t("placeOrder.addItem", { name: item.name })}
          onClick={onAdd}
        >
          +
        </button>
      )}
    </article>
  );
}
