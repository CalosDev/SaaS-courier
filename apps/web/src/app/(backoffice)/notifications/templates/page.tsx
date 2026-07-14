"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Bell, Power } from "lucide-react";

import { PermissionBoundary } from "@/components/auth/permission-boundary";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Table } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncState } from "@/hooks/use-async-state";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";

const VARIABLES = [
  "organizationName",
  "customerCode",
  "trackingNumber",
  "status",
  "eventType",
] as const;

export default function NotificationTemplatesPage() {
  const resource = useAsyncState(
    useCallback(() => backofficeApi.listNotificationTemplates(), []),
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setError(null);
    try {
      await backofficeApi.createNotificationTemplate({
        code: String(data.get("code") || "").trim().toUpperCase(),
        eventType: String(data.get("eventType") || "").trim(),
        subjectTemplate: String(data.get("subjectTemplate") || ""),
        bodyTemplate: String(data.get("bodyTemplate") || ""),
        allowedVariables: VARIABLES.filter((variable) =>
          data.has(`variable:${variable}`),
        ),
      });
      form.reset();
      setMessage("Plantilla creada.");
      await resource.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No fue posible crear la plantilla.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(templateId: string, isActive: boolean) {
    setError(null);
    try {
      await backofficeApi.updateNotificationTemplate(templateId, { isActive: !isActive });
      await resource.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No fue posible actualizar la plantilla.");
    }
  }

  if (resource.status === "loading") return <LoadingState label="Cargando plantillas..." />;
  if (resource.status === "error") {
    return <ErrorState title="No fue posible cargar plantillas" description={resource.error.message} onRetry={() => void resource.refresh()} />;
  }

  return (
    <PermissionBoundary requiredPermissions={["notifications.read"]}>
      <div className="page-stack">
        <section className="page-header">
          <div><h1>Plantillas de notificación</h1><p>Correo transaccional generado exclusivamente desde eventos outbox.</p></div>
          <Link className="inline-flex min-h-[42px] items-center rounded-lg bg-[#dde6ed] px-4 font-medium" href="/notifications/deliveries">Ver entregas</Link>
        </section>
        {message ? <Alert tone="success">{message}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        <PermissionBoundary requiredPermissions={["notifications.manage"]}>
          <Card>
            <h2>Nueva plantilla EMAIL</h2>
            <form className="form-grid" onSubmit={(event) => void create(event)}>
              <FormField label="Código"><Input name="code" pattern="[A-Za-z0-9_]+" maxLength={80} required /></FormField>
              <FormField label="Evento outbox"><Input name="eventType" placeholder="package.received" maxLength={120} required /></FormField>
              <FormField label="Asunto"><Input name="subjectTemplate" maxLength={240} required /></FormField>
              <FormField label="Contenido"><Textarea name="bodyTemplate" rows={6} maxLength={10000} required /></FormField>
              <FormField label="Variables permitidas">
                <div className="button-row">
                  {VARIABLES.map((variable) => <label key={variable}><Checkbox name={`variable:${variable}`} /> {variable}</label>)}
                </div>
              </FormField>
              <Button type="submit" disabled={submitting}><Bell className="button-icon" /><span>Crear plantilla</span></Button>
            </form>
          </Card>
        </PermissionBoundary>
        <Card>
          <Table
            columns={["Código", "Evento", "Canal", "Estado", "Acción"]}
            rows={resource.data.map((template) => [
              template.code,
              template.eventType,
              template.channel,
              <Badge key={`${template.id}-status`} tone={template.isActive ? "success" : "neutral"}>{template.isActive ? "Activa" : "Inactiva"}</Badge>,
              <PermissionBoundary key={template.id} requiredPermissions={["notifications.manage"]}>
                <Button variant="secondary" onClick={() => void toggle(template.id, template.isActive)}><Power className="button-icon" /><span>{template.isActive ? "Desactivar" : "Activar"}</span></Button>
              </PermissionBoundary>,
            ])}
          />
        </Card>
      </div>
    </PermissionBoundary>
  );
}
