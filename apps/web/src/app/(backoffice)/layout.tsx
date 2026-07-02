import { AuthenticatedApp } from "@/components/auth/authenticated-app";
import { AppShell } from "@/components/layout/app-shell";

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedApp>
      <AppShell>{children}</AppShell>
    </AuthenticatedApp>
  );
}
