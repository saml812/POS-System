import { apiRequest } from "./client";
import type { SessionUser } from "../types";

type AuthStatusResponse = {
  authenticated: boolean;
  user?: SessionUser;
};

type LoginResponse = {
  user: SessionUser;
};

export function getAuthStatus() {
  return apiRequest<AuthStatusResponse>("/auth/status");
}

export function login(email: string, password: string) {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return apiRequest<{ message: string }>("/auth/logout", {
    method: "POST",
  });
}
