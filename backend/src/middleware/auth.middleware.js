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
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).send('Access Denied')
    }
    next();
  };
};