"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { PermissionBoundary } from "@/components/auth/permission-boundary";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { useAsyncState } from "@/hooks/use-async-state";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";

export default function NotificationDeliveriesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const resource = useAsyncState(
    useCallback(() => backofficeApi.listNotificationDeliveries({ page, pageSize: 25, status: status || undefined }), [page, status]),
  );
  async function retry(id: string) {
    setError(null);
    try {
      await backofficeApi.retryNotificationDelivery(id);
      await resource.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No fue posible reintentar la entrega.");
    }
  }
  if (resource.status === "loading") return <LoadingState label="Cargando entregas..." />;
  if (resource.status === "error") return <ErrorState title="No fue posible cargar entregas" description={resource.error.message} onRetry={() => void resource.refresh()} />;
  return (
    <PermissionBoundary requiredPermissions={["notifications.read"]}>
      <div className="page-stack">
        <section className="page-header"><div><h1>Entregas de correo</h1><p>Estado, intentos y errores sanitizados del worker SMTP.</p></div><Link className="inline-flex min-h-[42px] items-center rounded-lg bg-[#dde6ed] px-4 font-medium" href="/notifications/templates">Plantillas</Link></section>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Card><Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Todos los estados</option>{["PENDING","PROCESSING","SENT","FAILED","DEAD_LETTER"].map((item) => <option key={item}>{item}</option>)}</Select></Card>
        <Card>
          <Table columns={["Fecha", "Plantilla", "Destinatario", "Asunto", "Estado", "Intentos", "Acción"]} rows={resource.data.items.map((delivery) => [delivery.createdAt.slice(0,16).replace("T"," "), delivery.template.code, delivery.recipient, delivery.subject, <Badge key={`${delivery.id}-status`} tone={delivery.status === "SENT" ? "success" : delivery.status === "FAILED" || delivery.status === "DEAD_LETTER" ? "danger" : "warning"}>{delivery.status}</Badge>, String(delivery.attempts), ["FAILED","DEAD_LETTER"].includes(delivery.status) ? <PermissionBoundary key={delivery.id} requiredPermissions={["notifications.manage"]}><Button variant="secondary" onClick={() => void retry(delivery.id)}><RefreshCw className="button-icon" /><span>Reintentar</span></Button></PermissionBoundary> : "—"])} />
          <Pagination page={resource.data.pagination.page} totalPages={resource.data.pagination.totalPages} onPageChange={setPage} />
        </Card>
      </div>
    </PermissionBoundary>
  );
}
