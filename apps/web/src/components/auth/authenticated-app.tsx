"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/lib/auth/auth-provider";

export function AuthenticatedApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (state.status === "anonymous") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, state.status]);

  if (state.status === "loading") {
    return <LoadingState label="Restaurando sesión..." />;
  }

  if (state.status === "anonymous") {
    return <LoadingState label="Redirigiendo a login..." />;
  }

  return <>{children}</>;
}
