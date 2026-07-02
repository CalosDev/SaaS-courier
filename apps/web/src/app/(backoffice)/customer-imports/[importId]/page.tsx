"use client";

import { use, useCallback, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table } from "@/components/ui/table";
import { useAsyncState } from "@/hooks/use-async-state";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import type { CustomerImportRow } from "@/lib/api/contracts";

export default function CustomerImportDetailPage({
  params,
}: {
  params: Promise<{ importId: string }>;
}) {
  const { importId } = use(params);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resource = useAsyncState(
    useCallback(() => backofficeApi.getCustomerImport(importId), [importId]),
  );

  if (resource.status === "loading") {
    return <LoadingState label="Cargando importacion..." />;
  }

  if (resource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar la importacion"
        description={resource.error.message}
        onRetry={() => void resource.refresh()}
      />
    );
  }

  const job = resource.data;
  const hasInvalidRows = (job.invalidRows || 0) > 0;

  async function runAction(action: "validate" | "commit" | "cancel") {
    setMessage(null);
    setError(null);

    try {
      if (action === "validate") {
        await backofficeApi.validateCustomerImport(importId);
      } else if (action === "commit") {
        await backofficeApi.commitCustomerImport(importId);
      } else {
        await backofficeApi.cancelCustomerImport(importId);
      }

      setMessage(`Accion ${action} ejecutada.`);
      await resource.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "No fue posible ejecutar la accion.",
      );
    }
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>{job.name || "Importacion sin nombre"}</h1>
          <p>{job.id}</p>
        </div>
        <Badge tone={job.status === "COMPLETED" ? "success" : "warning"}>
          {job.status}
        </Badge>
      </section>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        <div className="actions-row">
          <Button onClick={() => void runAction("validate")}>Validar</Button>
          <Button
            onClick={() => void runAction("commit")}
            disabled={
              hasInvalidRows || job.status === "COMPLETED" || job.status === "CANCELLED"
            }
          >
            Confirmar commit
          </Button>
          <Button
            variant="secondary"
            onClick={() => void runAction("cancel")}
            disabled={job.status === "COMPLETED" || job.status === "CANCELLED"}
          >
            Cancelar
          </Button>
        </div>
      </Card>

      <Card>
        <Table
          columns={["#", "Estado", "Errores", "Cliente importado"]}
          rows={(job.rows || []).map((row: CustomerImportRow) => [
            row.rowNumber,
            row.status,
            row.validationErrors?.join(", ") || "Sin errores",
            row.importedCustomerId || "Pendiente",
          ])}
        />
      </Card>
    </div>
  );
}
