import { useLocale } from "../../context/LocaleContext";
import type { MenuItem, MenuItemOption, MenuItemSize } from "../../types";
import {
  formatItemLabel,
  formatMoney,
  formatOptionNames,
} from "../../utils/order";

export type CartLineView = {
  key: string;
  item: MenuItem;
  optionIds: string[];
  sizeId: string | null;
  selectedOptions: MenuItemOption[];
  selectedSize?: MenuItemSize | null;
  preferences?: string;
  unitPrice: number;
  quantity: number;
};

type CartPanelProps = {
  lines: CartLineView[];
  total: number;
  canPlace: boolean;
  submitting: boolean;
  onChangeQuantity: (key: string, delta: number) => void;
  onEdit: (line: CartLineView) => void;
  onRemove: (key: string) => void;
  onCheckout: () => void;
  className?: string;
};

export function CartPanel({
  lines,
  total,
  canPlace,
  submitting,
  onChangeQuantity,
  onEdit,
  onRemove,
  onCheckout,
  className = "",
}: CartPanelProps) {
  const { t } = useLocale();

  return (
    <aside className={`dd-cart ${className}`.trim()}>
      <div className="dd-cart-header">
        <h3>{t("placeOrder.currentOrder")}</h3>
        {lines.length > 0 && (
          <span className="dd-cart-count">
            {t("placeOrder.itemCount", { count: lines.reduce((s, l) => s + l.quantity, 0) })}
          </span>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="dd-cart-empty">
          <span className="dd-cart-empty-icon" aria-hidden>
            🛒
          </span>
          <p>{t("placeOrder.noItems")}</p>
        </div>
      ) : (
        <>
          <ul className="dd-cart-lines">
            {lines.map((line) => (
              <li key={line.key} className="dd-cart-line">
                <div className="dd-cart-line-info">
                  <span className="dd-cart-line-name">
                    {formatItemLabel(
                      line.item.name,
                      line.item.itemNumber,
                      line.quantity,
                    )}
                  </span>
                  {line.selectedSize && (
                    <span className="dd-cart-line-size">
                      {line.selectedSize.name}
                    </span>
                  )}
                  {line.selectedOptions.length > 0 && (
                    <span className="dd-cart-line-options">
                      {formatOptionNames(line.selectedOptions)}
                    </span>
                  )}
                  {line.preferences ? (
                    <span className="dd-cart-line-preferences">
                      {line.preferences}
                    </span>
                  ) : null}
                  <span className="dd-cart-line-price">
                    {formatMoney(line.unitPrice * line.quantity)}
                  </span>
                </div>
                {canPlace && (
                  <div className="dd-qty-control">
                    <button
                      type="button"
                      className="dd-qty-btn"
                      onClick={() => onChangeQuantity(line.key, -1)}
                      aria-label={t("placeOrder.decreaseQty")}
                    >
                      −
                    </button>
                    <span className="dd-qty-value">{line.quantity}</span>
                    <button
                      type="button"
                      className="dd-qty-btn"
                      onClick={() => onChangeQuantity(line.key, 1)}
                      aria-label={t("placeOrder.increaseQty")}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="dd-edit-btn"
                      onClick={() => onEdit(line)}
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      type="button"
                      className="dd-remove-btn"
                      onClick={() => onRemove(line.key)}
                    >
                      {t("common.remove")}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="dd-cart-footer">
            <div className="dd-cart-total-row">
              <span>{t("placeOrder.subtotal")}</span>
              <strong>{formatMoney(total)}</strong>
            </div>
            {canPlace && (
              <button
                type="button"
                className="btn btn-brand btn-block"
                disabled={submitting}
                onClick={onCheckout}
              >
                {submitting ? t("placeOrder.placing") : t("placeOrder.checkout")}
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
