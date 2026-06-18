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
  chicken: "🐔",
  pork: "🐷",
  beef: "🐮",
  shrimp: "🦐",
  drinks: "🥤",
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
    <button
      type="button"
      className="dd-item-card-tile"
      disabled={!canAdd}
      aria-label={t("placeOrder.addItem", { name: item.name })}
      onClick={onAdd}
    >
      <div className="dd-item-visual" aria-hidden>
        <span className="dd-item-icon">{icon}</span>
      </div>
      <div className="dd-item-body">
        <h4 className="dd-item-name">
          {item.itemNumber ? (
            <span className="dd-item-code">{item.itemNumber}</span>
          ) : null}
          <span className="dd-item-name-text">{item.name}</span>
        </h4>
        <div className="dd-item-meta">
          <span className="dd-item-price">{formatMoney(item.price)}</span>
          {hasOptions ? (
            <span className="dd-item-customizable">
              {t("placeOrder.customizable")}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
