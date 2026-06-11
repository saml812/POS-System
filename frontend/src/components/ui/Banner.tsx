import type { ReactNode } from "react";

type BannerVariant = "error" | "success" | "warning";

type BannerProps = {
  variant: BannerVariant;
  children: ReactNode;
  as?: "p" | "div";
};

export function Banner({ variant, children, as: Tag = "p" }: BannerProps) {
  return <Tag className={`toast-banner ${variant}`}>{children}</Tag>;
}
