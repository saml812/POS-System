import type { Role, SessionUser } from "../types";

export function hasRole(
  user: SessionUser | null | undefined,
  ...roles: Role[]
): boolean {
  return user != null && roles.includes(user.role);
}

export function canPlaceOrders(user: SessionUser | null | undefined) {
  return hasRole(user, "CASHIER", "MANAGER");
}

export function canViewKitchen(user: SessionUser | null | undefined) {
  return hasRole(user, "KITCHEN", "MANAGER");
}

export function canViewCashier(user: SessionUser | null | undefined) {
  return hasRole(user, "CASHIER", "MANAGER");
}

export function isManager(user: SessionUser | null | undefined) {
  return hasRole(user, "MANAGER");
}
