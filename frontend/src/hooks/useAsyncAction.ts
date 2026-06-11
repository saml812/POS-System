import { useCallback, useState } from "react";
import { getErrorMessage } from "../api/client";

type RunOptions = {
  successMessage?: string;
  onAfter?: () => Promise<void> | void;
  busyId?: string | null;
};

export function useAsyncAction(fallbackMessage: string) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const clearMessages = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);

  const run = useCallback(
    async (action: () => Promise<unknown>, options: RunOptions = {}) => {
      clearMessages();
      setBusy(true);
      setActionId(options.busyId ?? "busy");

      try {
        await action();
        if (options.onAfter) {
          await options.onAfter();
        }
        if (options.successMessage) {
          setSuccess(options.successMessage);
        }
      } catch (err) {
        setError(getErrorMessage(err, fallbackMessage));
      } finally {
        setBusy(false);
        setActionId(null);
      }
    },
    [clearMessages, fallbackMessage],
  );

  return {
    error,
    success,
    busy,
    actionId,
    setError,
    setSuccess,
    clearMessages,
    run,
  };
}
