import { useLocale } from "../../context/LocaleContext";
import type { TenderType } from "../../types";
import { formatMoney } from "../../utils/order";

const TENDER_METHODS: TenderType[] = ["CASH", "CARD", "SPLIT"];

type TenderFieldsProps = {
  method: TenderType;
  onMethodChange: (method: TenderType) => void;
  cardAmountInput: string;
  onCardAmountInputChange: (value: string) => void;
  cashRemainder: number;
  total: number;
  hint: string;
  label: string;
  busy?: boolean;
};

export function TenderFields({
  method,
  onMethodChange,
  cardAmountInput,
  onCardAmountInputChange,
  cashRemainder,
  total,
  hint,
  label,
  busy = false,
}: TenderFieldsProps) {
  const { t } = useLocale();

  return (
    <div className="checkout-methods">
      <p className="checkout-manual-hint muted">{hint}</p>
      <span className="checkout-methods-label">{label}</span>
      <div className="checkout-method-grid">
        {TENDER_METHODS.map((value) => (
          <button
            key={value}
            type="button"
            className={`checkout-method-btn ${method === value ? "active" : ""}`}
            disabled={busy}
            onClick={() => onMethodChange(value)}
          >
            {t(`checkout.tenders.${value}`)}
          </button>
        ))}
      </div>

      {method === "SPLIT" ? (
        <label className="checkout-split-field">
          <span>{t("checkout.cardAmount")}</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={total - 0.01}
            className="dd-input"
            value={cardAmountInput}
            onChange={(e) => onCardAmountInputChange(e.target.value)}
            disabled={busy}
          />
          <span className="muted">
            {t("checkout.cashRemainder", { amount: formatMoney(cashRemainder) })}
          </span>
        </label>
      ) : null}
    </div>
  );
}
