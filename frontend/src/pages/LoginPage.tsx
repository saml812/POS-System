import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { getErrorMessage } from "../api/client";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const { t } = useLocale();
  const [email, setEmail] = useState("manager@demo.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(getErrorMessage(err, t("login.failed")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-center login-page">
      <div className="login-lang">
        <LanguageSwitcher />
      </div>
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1>{t("login.title")}</h1>
        <p className="muted">{t("login.subtitle")}</p>

        <label>
          {t("login.email")}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </label>

        <label>
          {t("login.password")}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? t("login.signingIn") : t("login.signIn")}
        </button>

      </form>
    </div>
  );
}
