import { asyncHandler } from "../middleware/asyncHandler.js";
import * as statsService from "../services/stats.service.js";

export const getSalesSummary = asyncHandler(async (req, res) => {
  const summary = await statsService.getSalesSummary();
  res.json({ summary });
});

export const exportOrdersCsv = asyncHandler(async (req, res) => {
  const beforeDate = req.query.before;
  const exported = await statsService.exportCompletedOrdersCsv(beforeDate);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${exported.filename}"`,
  );
  res.send(exported.csv);
});

export const archiveOrders = asyncHandler(async (req, res) => {
  const { beforeDate } = req.body ?? {};
  const result = await statsService.archiveCompletedOrders(beforeDate);

  res.json({
    ok: true,
    beforeDate: result.beforeDate,
    orderCount: result.orderCount,
    deletedCount: result.deletedCount,
    filename: result.filename,
    csv: result.csv,
  });
});
