import { useState, type FormEvent } from "react";
import { useLocale } from "../context/LocaleContext";

type CancelOrderFormProps = {
  onConfirm: (reason?: string) => void;
  onDismiss: () => void;
  busy?: boolean;
};

export function CancelOrderForm({
  onConfirm,
  onDismiss,
  busy = false,
}: CancelOrderFormProps) {
  const { t } = useLocale();
  const [reason, setReason] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onConfirm(reason.trim() || undefined);
  }

  return (
    <form className="ft-cancel-form" onSubmit={handleSubmit}>
      <label className="ft-cancel-field">
        <span className="ft-cancel-label">{t("order.cancel.reason")}</span>
        <input
          className="ft-cancel-input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("order.cancel.reasonPlaceholder")}
        />
      </label>
      <div className="ft-cancel-actions">
        <button
          type="submit"
          className="btn ft-action-danger"
          disabled={busy}
        >
          {busy ? t("order.cancel.cancelling") : t("order.cancel.confirm")}
        </button>
        <button
          type="button"
          className="btn btn-small"
          disabled={busy}
          onClick={onDismiss}
        >
          {t("order.cancel.keep")}
        </button>
      </div>
    </form>
  );
}
