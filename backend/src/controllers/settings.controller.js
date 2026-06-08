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

export const resetTicketReset = asyncHandler(async (req, res) => {
  const settings = await settingsService.resetTicketResetToEnvDefaults();
  res.json({ settings });
});
