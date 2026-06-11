import { useLocale } from "../../context/LocaleContext";

type FeedHeroProps = {
  title: string;
  subtitle: string;
  loading?: boolean;
  onRefresh: () => void;
};

export function FeedHero({ title, subtitle, loading, onRefresh }: FeedHeroProps) {
  const { t } = useLocale();

  return (
    <header className="ft-hero">
      <div className="ft-hero-text">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <button
        type="button"
        className="btn btn-secondary ft-refresh-btn"
        disabled={loading}
        onClick={onRefresh}
      >
        {t("common.refresh")}
      </button>
    </header>
  );
}
