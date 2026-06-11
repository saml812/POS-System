import { useLocale } from "../context/LocaleContext";
import type { Locale } from "../i18n/translations";

type LanguageSwitcherProps = {
  compact?: boolean;
};

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useLocale();

  const options: Locale[] = ["en", "zh"];

  return (
    <div
      className={compact ? "lang-switcher lang-switcher-compact" : "lang-switcher"}
      role="group"
      aria-label="Language"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={locale === option ? "lang-btn active" : "lang-btn"}
          onClick={() => setLocale(option)}
        >
          {t(`lang.${option}`)}
        </button>
      ))}
    </div>
  );
}
