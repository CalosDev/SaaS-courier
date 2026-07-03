"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { PermissionBoundary } from "@/components/auth/permission-boundary";
import {
  PrealertForm,
  type PrealertSubmitPayload,
} from "@/components/prealerts/prealert-form";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useAsyncState } from "@/hooks/use-async-state";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";

export default function NewPrealertPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const resource = useAsyncState(
    useCallback(() => backofficeApi.getCurrentOrganization(), []),
  );

  async function handleSubmit(payload: PrealertSubmitPayload) {
    setSubmitting(true);
    setError(null);

    try {
      const prealert = await backofficeApi.createPrealert(payload);
      router.push(`/prealerts/${prealert.id}`);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "No fue posible registrar la prealerta.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (resource.status === "loading") {
    return <LoadingState label="Preparando formulario de prealerta..." />;
  }

  if (resource.status === "error") {
    return (
      <ErrorState
        title="No fue posible preparar la prealerta"
        description={resource.error.message}
        onRetry={() => void resource.refresh()}
      />
    );
  }

  return (
    <PermissionBoundary
      requiredPermissions={["prealerts.manage"]}
      fallback={
        <ErrorState
          title="Acceso no autorizado"
          description="Tu sesion no tiene permisos para crear prealertas."
        />
      }
    >
      <div className="page-stack">
        <section className="page-header">
          <div>
            <h1>Nueva prealerta</h1>
            <p>Registra una compra esperada antes de que llegue al almacen.</p>
          </div>
        </section>

        <Card>
          <PrealertForm
            organizationCurrencyCode={resource.data.currencyCode}
            submitLabel="Registrar prealerta"
            submitting={submitting}
            error={error}
            onSubmit={handleSubmit}
          />
        </Card>
      </div>
    </PermissionBoundary>
  );
}
