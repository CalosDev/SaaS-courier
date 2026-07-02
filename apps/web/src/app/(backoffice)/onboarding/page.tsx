"use client";

import { useCallback, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useAsyncState } from "@/hooks/use-async-state";
import { backofficeApi } from "@/lib/api/backoffice";
import { ApiError } from "@/lib/api/api-error";

export default function OnboardingPage() {
  const resource = useAsyncState(useCallback(() => backofficeApi.getOnboarding(), []));
  const [error, setError] = useState<string | null>(null);

  if (resource.status === "loading") {
    return <LoadingState label="Cargando onboarding..." />;
  }

  if (resource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar el onboarding"
        description={resource.error.message}
        onRetry={() => void resource.refresh()}
      />
    );
  }

  async function handleComplete() {
    setError(null);

    try {
      await backofficeApi.completeOnboarding();
      await resource.refresh();
    } catch (error) {
      setError(error instanceof ApiError ? error.message : "No fue posible completar.");
    }
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Onboarding</h1>
          <p>Validación del estado inicial de la operación.</p>
        </div>
        <Badge tone={resource.data.status === "COMPLETED" ? "success" : "warning"}>
          {resource.data.status}
        </Badge>
      </section>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        <ul className="simple-list">
          {resource.data.steps.map((step) => (
            <li key={step.code}>
              <span>{step.code}</span>
              <Badge tone={step.completed ? "success" : "warning"}>
                {step.completed ? "Completado" : "Pendiente"}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Button
        onClick={() => void handleComplete()}
        disabled={resource.data.status === "COMPLETED"}
      >
        Marcar onboarding como completado
      </Button>
    </div>
  );
}
