import { useLocale } from "../../context/LocaleContext";
import type { ResolvedCartLine } from "../../hooks/useCart";
import { formatMoney } from "../../utils/order";
import { CartPanel } from "./CartPanel";

type MobileCartDrawerProps = {
  lines: ResolvedCartLine[];
  total: number;
  itemCount: number;
  canPlace: boolean;
  submitting: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChangeQuantity: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
  onCheckout: () => void;
};

export function MobileCartBar({
  itemCount,
  total,
  onOpen,
}: Pick<MobileCartDrawerProps, "itemCount" | "total" | "onOpen">) {
  const { t } = useLocale();

  return (
    <div className="dd-mobile-cart-bar">
      <button type="button" className="dd-mobile-cart-trigger" onClick={onOpen}>
        <span className="dd-mobile-cart-badge">{itemCount}</span>
        <span>{t("placeOrder.viewCart")}</span>
        <strong>{formatMoney(total)}</strong>
      </button>
    </div>
  );
}

export function MobileCartDrawer({
  lines,
  total,
  canPlace,
  submitting,
  open,
  onClose,
  onChangeQuantity,
  onRemove,
  onCheckout,
}: Omit<MobileCartDrawerProps, "itemCount" | "onOpen">) {
  const { t } = useLocale();

  if (!open) return null;

  return (
    <div className="dd-cart-drawer-backdrop" onClick={onClose}>
      <div className="dd-cart-drawer" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="dd-drawer-close"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          ×
        </button>
        <CartPanel
          lines={lines}
          total={total}
          canPlace={canPlace}
          submitting={submitting}
          onChangeQuantity={onChangeQuantity}
          onRemove={onRemove}
          onCheckout={onCheckout}
        />
      </div>
    </div>
  );
}
