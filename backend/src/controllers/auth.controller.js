import passport from "../lib/passport.js";

function toSessionUser(user) {
  const { id, email, role } = user;
  return { id, email, role };
}

function toFullUser(user) {
  const { id, email, role, isActive, createdAt, updatedAt } = user;
  return { id, email, role, isActive, createdAt, updatedAt };
}

export function getStatus(req, res) {
  if (req.isAuthenticated?.() && req.user) {
    return res.json({
      authenticated: true,
      user: toSessionUser(req.user),
    });
  }

  res.json({ authenticated: false });
}

export function login(req, res, next) {
  passport.authenticate("local", (error, user, info) => {
    if (error) {
      return next(error);
    }

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: info?.message || "Invalid email or password",
      });
    }

    req.login(user, (loginError) => {
      if (loginError) {
        return next(loginError);
      }

      res.json({ user: toSessionUser(user) });
    });
  })(req, res, next);
}

export function logout(req, res, next) {
  req.logout((logoutError) => {
    if (logoutError) {
      return next(logoutError);
    }

    req.session.destroy((sessionError) => {
      if (sessionError) {
        return next(sessionError);
      }

      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });
}

export function getMe(req, res) {
  res.json({ user: toFullUser(req.user) });
}
