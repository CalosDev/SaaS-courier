"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/lib/auth/auth-provider";

export default function Home() {
  const router = useRouter();
  const { state } = useAuth();

  useEffect(() => {
    if (state.status === "authenticated") {
      router.replace("/dashboard");
      return;
    }

    if (state.status === "anonymous") {
      router.replace("/login");
    }
  }, [router, state.status]);

  return <LoadingState label="Preparando aplicación..." />;
}
