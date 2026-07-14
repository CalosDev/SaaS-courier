"use client";

import { useCallback } from "react";

import { PermissionBoundary } from "@/components/auth/permission-boundary";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table } from "@/components/ui/table";
import { useAsyncState } from "@/hooks/use-async-state";
import { backofficeApi } from "@/lib/api/backoffice";

export default function SystemStatusPage() {
  const resource = useAsyncState(useCallback(() => backofficeApi.getSystemReadiness(), []));
  if (resource.status === "loading") return <LoadingState label="Verificando servicios..." />;
  if (resource.status === "error") return <ErrorState title="El sistema no está listo" description={resource.error.message} onRetry={() => void resource.refresh()} />;
  const checks = resource.data.checks;
  return (
    <PermissionBoundary requiredPermissions={["organizations.read"]}>
      <div className="page-stack">
        <section className="page-header"><div><h1>Estado del sistema</h1><p>Disponibilidad de dependencias necesarias para operar el piloto.</p></div><Badge tone="success">READY</Badge></section>
        <Card><Table columns={["Componente", "Estado"]} rows={[["PostgreSQL", checks.database], ["Object storage", checks.objectStorage], ["SMTP", checks.smtp]]} /><p>Última verificación: {resource.data.timestamp.slice(0, 19).replace("T", " ")}</p></Card>
      </div>
    </PermissionBoundary>
  );
}
