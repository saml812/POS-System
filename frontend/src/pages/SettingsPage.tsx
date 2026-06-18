import { useCallback, useEffect, useState, type FormEvent } from "react";
import * as settingsApi from "../api/settings";
import type { Settings } from "../api/settings";
import { Banner } from "../components/ui/Banner";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useGuardedLoad } from "../hooks/useGuardedLoad";
import { useOrderSocket } from "../hooks/useOrderSocket";
import { isManager } from "../lib/permissions";

const RESET_HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export function SettingsPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const manager = isManager(user);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [timezone, setTimezone] = useState("");
  const [resetHour, setResetHour] = useState("0");

  const [printerType, setPrinterType] = useState("network");
  const [printerIp, setPrinterIp] = useState("");
  const [printerPort, setPrinterPort] = useState("9100");
  const [printerName, setPrinterName] = useState("");
  const [printerComPort, setPrinterComPort] = useState("");
  const [printerBaudRate, setPrinterBaudRate] = useState("9600");
  const [storeName, setStoreName] = useState("POS");
  const [storeAddress, setStoreAddress] = useState("");

  const applySettings = useCallback((next: Settings) => {
    setSettings(next);
    setTimezone(next.ticketReset.timezone ?? "");
    setResetHour(String(next.ticketReset.resetHour));
    setPrinterType(next.receipt.printerType);
    setPrinterIp(next.receipt.printerIp ?? "");
    setPrinterPort(String(next.receipt.printerPort));
    setPrinterName(next.receipt.printerName ?? "");
    setPrinterComPort(next.receipt.printerComPort ?? "");
    setPrinterBaudRate(String(next.receipt.printerBaudRate));
    setStoreName(next.receipt.storeName);
    setStoreAddress(next.receipt.storeAddress ?? "");
  }, []);

  const loadSettings = useCallback(async () => {
    const data = await settingsApi.getSettings();
    applySettings(data.settings);
  }, [applySettings]);

  const { loading, error } = useGuardedLoad(manager, loadSettings);
  const { success, busy, run } = useAsyncAction(t("common.requestFailed"));
  const receiptAction = useAsyncAction(t("settings.receiptSaveFailed"));

  useEffect(() => {
    if (!manager) return;

    const refreshStatus = () => {
      loadSettings().catch(() => undefined);
    };

    window.addEventListener("focus", refreshStatus);
    return () => window.removeEventListener("focus", refreshStatus);
  }, [manager, loadSettings]);

  useOrderSocket({
    enabled: manager,
    onOrder: (event) => {
      if (event !== "order:created") return;
      loadSettings().catch(() => undefined);
    },
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    await run(
      async () => {
        const result = await settingsApi.updateTicketReset({
          timezone: timezone.trim(),
          resetHour: Number(resetHour),
        });
        applySettings(result.settings);
      },
      { successMessage: t("settings.saved") },
    );
  }

  async function handleReceiptSubmit(event: FormEvent) {
    event.preventDefault();

    await receiptAction.run(
      async () => {
        const result = await settingsApi.updateReceiptSettings({
          printerType,
          printerIp: printerIp.trim(),
          printerPort: Number(printerPort),
          printerName: printerName.trim(),
          printerComPort: printerComPort.trim(),
          printerBaudRate: Number(printerBaudRate),
          storeName: storeName.trim(),
          storeAddress: storeAddress.trim(),
        });
        applySettings(result.settings);
      },
      { successMessage: t("settings.receiptSaved") },
    );
  }

  async function handleTestReceipt() {
    await receiptAction.run(
      () => settingsApi.testReceiptPrinter(),
      { successMessage: t("settings.receiptTestOk") },
    );
  }

  const displayError = error || receiptAction.error;
  const displaySuccess = success || receiptAction.success;
  const receiptBusy = receiptAction.busy;
  const printerDisabled = receiptBusy || printerType === "none";
  const showNetworkFields = printerType === "network";
  const showUsbFields = printerType === "usb";
  const showSerialFields = printerType === "serial";

  return (
    <div className="page em-page settings-page">
      <header className="em-hero">
        <div className="em-hero-text">
          <h1>{t("settings.title")}</h1>
          <p>{t("settings.subtitle")}</p>
        </div>
      </header>

      {!manager && <Banner variant="warning">{t("settings.roleWarning")}</Banner>}

      {loading && <p className="muted">{t("settings.loading")}</p>}
      {displayError && <Banner variant="error">{displayError}</Banner>}
      {displaySuccess && <Banner variant="success">{displaySuccess}</Banner>}

      {manager && settings && !loading ? (
        <div className="settings-layout">
          <section className="em-form-panel settings-status-panel">
            <h3>{t("settings.ticketStatusTitle")}</h3>
            <div className="settings-stats">
              <div className="settings-stat">
                <span className="settings-stat-label">
                  {t("settings.businessDate")}
                </span>
                <strong>{settings.ticketStatus.businessDate}</strong>
              </div>
              <div className="settings-stat">
                <span className="settings-stat-label">
                  {t("settings.lastTicket")}
                </span>
                <strong>#{settings.ticketStatus.lastTicketNumber}</strong>
              </div>
            </div>
          </section>

          <section className="em-form-panel">
            <h3>{t("settings.ticketResetTitle")}</h3>
            <p className="muted">{t("settings.ticketResetDesc")}</p>
            <p className="settings-warning">{t("settings.ticketResetWarning")}</p>

            <form className="em-form" onSubmit={handleSubmit}>
              <div className="em-form-grid">
                <label className="em-field em-field-full">
                  <span className="em-field-label">{t("settings.timezone")}</span>
                  <input
                    className="em-input"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder={t("settings.timezonePlaceholder")}
                  />
                  <span className="settings-hint muted">
                    {t("settings.timezoneHint")}
                  </span>
                </label>

                <label className="em-field">
                  <span className="em-field-label">{t("settings.resetHour")}</span>
                  <select
                    className="em-input"
                    value={resetHour}
                    onChange={(e) => setResetHour(e.target.value)}
                  >
                    {RESET_HOURS.map((hour) => (
                      <option key={hour} value={hour}>
                        {String(hour).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                  <span className="settings-hint muted">
                    {t("settings.resetHourHint")}
                  </span>
                </label>
              </div>

              <div className="em-form-actions">
                <button type="submit" className="btn btn-brand" disabled={busy}>
                  {busy ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </form>
          </section>

          <section className="em-form-panel">
            <h3>{t("settings.receiptTitle")}</h3>
            <p className="muted">{t("settings.receiptDesc")}</p>

            <form className="em-form" onSubmit={handleReceiptSubmit}>
              <div className="em-form-grid">
                <label className="em-field">
                  <span className="em-field-label">{t("settings.printerType")}</span>
                  <select
                    className="em-input"
                    value={printerType}
                    onChange={(e) => setPrinterType(e.target.value)}
                    disabled={receiptBusy}
                  >
                    <option value="network">{t("settings.printerNetwork")}</option>
                    <option value="usb">{t("settings.printerUsb")}</option>
                    <option value="serial">{t("settings.printerSerial")}</option>
                    <option value="none">{t("settings.printerNone")}</option>
                  </select>
                </label>
                {showNetworkFields ? (
                  <>
                    <label className="em-field">
                      <span className="em-field-label">{t("settings.printerIp")}</span>
                      <input
                        className="em-input"
                        value={printerIp}
                        onChange={(e) => setPrinterIp(e.target.value)}
                        placeholder="192.168.1.60"
                        disabled={printerDisabled}
                      />
                    </label>
                    <label className="em-field">
                      <span className="em-field-label">{t("settings.printerPort")}</span>
                      <input
                        className="em-input"
                        type="number"
                        min={1}
                        max={65535}
                        value={printerPort}
                        onChange={(e) => setPrinterPort(e.target.value)}
                        disabled={printerDisabled}
                      />
                    </label>
                  </>
                ) : null}
                {showUsbFields ? (
                  <label className="em-field em-field-full">
                    <span className="em-field-label">{t("settings.printerName")}</span>
                    <input
                      className="em-input"
                      value={printerName}
                      onChange={(e) => setPrinterName(e.target.value)}
                      placeholder={t("settings.printerNamePlaceholder")}
                      disabled={printerDisabled}
                    />
                    <span className="settings-hint muted">
                      {t("settings.printerUsbHint")}
                    </span>
                  </label>
                ) : null}
                {showSerialFields ? (
                  <>
                    <label className="em-field">
                      <span className="em-field-label">{t("settings.printerComPort")}</span>
                      <input
                        className="em-input"
                        value={printerComPort}
                        onChange={(e) => setPrinterComPort(e.target.value)}
                        placeholder="COM5"
                        disabled={printerDisabled}
                      />
                    </label>
                    <label className="em-field">
                      <span className="em-field-label">{t("settings.printerBaudRate")}</span>
                      <input
                        className="em-input"
                        type="number"
                        min={1}
                        value={printerBaudRate}
                        onChange={(e) => setPrinterBaudRate(e.target.value)}
                        disabled={printerDisabled}
                      />
                      <span className="settings-hint muted">
                        {t("settings.printerSerialHint")}
                      </span>
                    </label>
                  </>
                ) : null}
                <label className="em-field">
                  <span className="em-field-label">{t("settings.storeName")}</span>
                  <input
                    className="em-input"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    disabled={receiptBusy}
                  />
                </label>
                <label className="em-field em-field-full">
                  <span className="em-field-label">{t("settings.storeAddress")}</span>
                  <input
                    className="em-input"
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    placeholder={t("settings.storeAddressPlaceholder")}
                    disabled={receiptBusy}
                  />
                </label>
              </div>

              <div className="settings-test-row">
                <button
                  type="button"
                  className="btn"
                  disabled={receiptBusy || printerType === "none"}
                  onClick={() => handleTestReceipt()}
                >
                  {t("settings.testReceipt")}
                </button>
                <span className="muted">
                  {settings.receipt.configured
                    ? t("settings.receiptConfigured")
                    : t("settings.receiptNotConfigured")}
                </span>
              </div>

              <div className="em-form-actions">
                <button
                  type="submit"
                  className="btn btn-brand"
                  disabled={receiptBusy}
                >
                  {receiptBusy ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
