import { asyncHandler } from "../middleware/asyncHandler.js";
import * as settingsService from "../services/settings.service.js";

export const getSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.getSettings();
  res.json({ settings });
});

export const updateTicketReset = asyncHandler(async (req, res) => {
  const { timezone, resetHour } = req.body ?? {};
  const settings = await settingsService.updateTicketReset({ timezone, resetHour });
  res.json({ settings });
});

export const updateReceiptSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateReceipt(req.body ?? {});
  res.json({ settings });
});

export const testReceiptPrinter = asyncHandler(async (req, res) => {
  const result = await settingsService.testReceiptPrinter();
  res.json(result);
});
