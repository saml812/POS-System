import type { ApiError } from "../types";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof ApiRequestError || err instanceof Error) {
    return err.message;
  }
  return fallback;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = data as ApiError;
    throw new ApiRequestError(
      response.status,
      error.message ?? `Request failed (${response.status})`,
    );
  }

  return data as T;
}
