import { cn } from "@/lib/cn";

export function Alert({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "success" | "warning" | "error";
}) {
  return <div className={cn("ui-alert", `ui-alert--${tone}`)}>{children}</div>;
}
