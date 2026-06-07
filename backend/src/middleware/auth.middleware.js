export function requireAuth(req, res, next) {
  if (req.isAuthenticated?.() && req.user) {
    return next();
  }

  const error = new Error("Authentication required");
  error.statusCode = 401;
  next(error);
}

export const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      const error = new Error("Authentication required");
      error.statusCode = 401;
      return next(error);
    }

    if (!roles.includes(req.user.role)) {
      const error = new Error("Access denied");
      error.statusCode = 403;
      return next(error);
    }

    next();
  };
};