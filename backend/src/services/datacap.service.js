import http from "node:http";
import { getPaymentConfig } from "../lib/paymentConfig.js";
import { appError } from "../lib/appError.js";

const TERMINAL_TIMEOUT_MS = 120_000;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tag(name, value) {
  if (value === undefined || value === null || value === "") return "";
  return `<${name}>${escapeXml(value)}</${name}>`;
}

function formatAmount(amount) {
  return Number(amount).toFixed(2);
}

export function buildSaleXml({
  merchantId,
  operationMode,
  invoiceNo,
  refNo,
  amount,
  ticketNumber,
}) {
  return `<TStream><Transaction>${tag("MerchantID", merchantId)}${tag("TranCode", "EMVSale")}${tag("InvoiceNo", invoiceNo)}${tag("RefNo", refNo)}${tag("RecordNo", "RecordNumberRequested")}<Amount><Purchase>${formatAmount(amount)}</Purchase></Amount>${tag("UserTrace", `Ticket ${ticketNumber}`)}${tag("OperationMode", operationMode)}</Transaction></TStream>`;
}

export function buildVoidSaleXml({
  merchantId,
  operationMode,
  invoiceNo,
  refNo,
  amount,
  acqRefData,
  process,
  recordNo,
}) {
  const inner = [
    tag("MerchantID", merchantId),
    tag("TranCode", "VoidSale"),
    tag("InvoiceNo", invoiceNo),
    tag("RefNo", refNo),
    `<Amount><Purchase>${formatAmount(amount)}</Purchase></Amount>`,
    tag("AcqRefData", acqRefData),
    tag("Process", process),
    tag("RecordNo", recordNo),
    tag("OperationMode", operationMode),
  ].join("");

  return `<TStream><Transaction>${inner}</Transaction></TStream>`;
}

export function buildVoidByRecordXml({
  merchantId,
  operationMode,
  invoiceNo,
  refNo,
  amount,
  recordNo,
}) {
  return `<TStream><Transaction>${tag("MerchantID", merchantId)}${tag("TranCode", "VoidSaleByRecordNo")}${tag("InvoiceNo", invoiceNo)}${tag("RefNo", refNo)}<Amount><Purchase>${formatAmount(amount)}</Purchase></Amount>${tag("RecordNo", recordNo)}${tag("Frequency", "OneTime")}${tag("OperationMode", operationMode)}</Transaction></TStream>`;
}

export function buildReturnXml({
  merchantId,
  operationMode,
  invoiceNo,
  refNo,
  amount,
  ticketNumber,
}) {
  return `<TStream><Transaction>${tag("MerchantID", merchantId)}${tag("TranCode", "EMVReturn")}${tag("InvoiceNo", invoiceNo)}${tag("RefNo", refNo)}<Amount><Purchase>${formatAmount(amount)}</Purchase></Amount>${tag("UserTrace", `Ticket ${ticketNumber}`)}${tag("OperationMode", operationMode)}</Transaction></TStream>`;
}

function extractTag(xml, tagName) {
  const re = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i");
  const match = xml.match(re);
  return match ? match[1].trim() : null;
}

export function parseDatacapResponse(xml) {
  const cmdStatus = extractTag(xml, "CmdStatus");
  const textResponse = extractTag(xml, "TextResponse");
  const authCode = extractTag(xml, "AuthCode");
  const refNo = extractTag(xml, "RefNo");
  const recordNo = extractTag(xml, "RecordNo");
  const acqRefData = extractTag(xml, "AcqRefData");
  const process = extractTag(xml, "Process");

  const approved =
    cmdStatus?.toLowerCase() === "approved" ||
    cmdStatus?.toLowerCase() === "success";

  return {
    raw: xml,
    cmdStatus,
    textResponse,
    authCode,
    refNo,
    recordNo,
    acqRefData,
    process,
    approved,
  };
}

function logPaymentEvent(details) {
  const { orderId, ticketNumber, tranCode, cmdStatus, textResponse, authCode, amount } =
    details;
  console.info(
    "[payment]",
    JSON.stringify({
      orderId,
      ticketNumber,
      tranCode,
      cmdStatus,
      textResponse,
      authCode,
      amount,
    }),
  );
}

export function postToTerminal(xmlBody, { tranCode, orderId, ticketNumber, amount } = {}) {
  const config = getPaymentConfig();

  if (!config.terminalIp || !config.merchantId) {
    throw appError("Payment terminal is not configured", 503);
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: config.terminalIp,
        port: config.terminalPort,
        path: "/",
        method: "POST",
        headers: {
          "Content-Type": "application/xml",
          "Content-Length": Buffer.byteLength(xmlBody),
        },
        timeout: TERMINAL_TIMEOUT_MS,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = parseDatacapResponse(data);
            logPaymentEvent({
              orderId,
              ticketNumber,
              tranCode,
              cmdStatus: parsed.cmdStatus,
              textResponse: parsed.textResponse,
              authCode: parsed.authCode,
              amount,
            });

            if (!parsed.cmdStatus) {
              reject(appError("Invalid response from payment terminal", 502));
              return;
            }

            resolve(parsed);
          } catch (err) {
            reject(err);
          }
        });
      },
    );

    req.on("timeout", () => {
      req.destroy();
      reject(appError("Payment terminal timed out", 504));
    });

    req.on("error", (err) => {
      reject(appError(`Payment terminal unreachable: ${err.message}`, 503));
    });

    req.write(xmlBody);
    req.end();
  });
}

export async function runSale({ orderId, ticketNumber, refNo, amount }) {
  const config = getPaymentConfig();
  const xml = buildSaleXml({
    merchantId: config.merchantId,
    operationMode: config.operationMode,
    invoiceNo: String(ticketNumber),
    refNo,
    amount,
    ticketNumber,
  });

  const result = await postToTerminal(xml, {
    tranCode: "EMVSale",
    orderId,
    ticketNumber,
    amount,
  });

  if (!result.approved) {
    throw appError(result.textResponse || "Card payment declined", 402);
  }

  return result;
}

export async function runVoidSale(order, refNo) {
  const config = getPaymentConfig();
  const amount = Number(order.cardAmount ?? 0);

  let xml = buildVoidSaleXml({
    merchantId: config.merchantId,
    operationMode: config.operationMode,
    invoiceNo: String(order.ticketNumber),
    refNo,
    amount,
    acqRefData: order.paymentAcqRefData,
    process: order.paymentProcess,
    recordNo: order.paymentRecordNo,
  });

  let result = await postToTerminal(xml, {
    tranCode: "VoidSale",
    orderId: order.id,
    ticketNumber: order.ticketNumber,
    amount,
  });

  if (!result.approved && order.paymentRecordNo) {
    xml = buildVoidByRecordXml({
      merchantId: config.merchantId,
      operationMode: config.operationMode,
      invoiceNo: String(order.ticketNumber),
      refNo,
      amount,
      recordNo: order.paymentRecordNo,
    });
    result = await postToTerminal(xml, {
      tranCode: "VoidSaleByRecordNo",
      orderId: order.id,
      ticketNumber: order.ticketNumber,
      amount,
    });
  }

  if (!result.approved) {
    throw appError(
      result.textResponse || "Unable to void card payment on terminal",
      402,
    );
  }

  return result;
}

export async function runReturn(order, refNo) {
  const config = getPaymentConfig();
  const amount = Number(order.cardAmount ?? 0);

  const xml = buildReturnXml({
    merchantId: config.merchantId,
    operationMode: config.operationMode,
    invoiceNo: String(order.ticketNumber),
    refNo,
    amount,
    ticketNumber: order.ticketNumber,
  });

  const result = await postToTerminal(xml, {
    tranCode: "EMVReturn",
    orderId: order.id,
    ticketNumber: order.ticketNumber,
    amount,
  });

  if (!result.approved) {
    throw appError(result.textResponse || "Card refund declined", 402);
  }

  return result;
}

export async function testTerminalConnection() {
  const config = getPaymentConfig();
  if (!config.terminalIp) {
    throw appError("Terminal IP is not configured", 400);
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: config.terminalIp,
        port: config.terminalPort,
        path: "/",
        method: "GET",
        timeout: 5000,
      },
      (res) => {
        res.resume();
        resolve({ reachable: true, statusCode: res.statusCode });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      reject(appError("Terminal did not respond", 504));
    });
    req.on("error", (err) => {
      reject(appError(`Terminal unreachable: ${err.message}`, 503));
    });
    req.end();
  });
}
