import { appError } from "../lib/appError.js";

let locked = false;

export function isTerminalBusy() {
  return locked;
}

export async function withTerminalLock(fn) {
  if (locked) {
    throw appError("Payment terminal is busy", 409);
  }

  locked = true;
  try {
    return await fn();
  } finally {
    locked = false;
  }
}
