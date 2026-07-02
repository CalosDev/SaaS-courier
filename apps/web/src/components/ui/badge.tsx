import { cn } from "@/lib/cn";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return <span className={cn("ui-badge", `ui-badge--${tone}`)}>{children}</span>;
}
