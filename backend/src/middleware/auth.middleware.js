import { appError } from "../lib/appError.js";

export function requireAuth(req, res, next) {
  if (req.isAuthenticated?.() && req.user) {
    return next();
  }

  next(appError("Authentication required", 401));
}

export const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(appError("Authentication required", 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(appError("Access denied", 403));
    }

    next();
  };
};
