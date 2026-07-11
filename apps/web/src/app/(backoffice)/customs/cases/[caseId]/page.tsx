"use client";

import Link from "next/link";
import { use, useCallback, useState } from "react";

import { PermissionBoundary } from "@/components/auth/permission-boundary";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { Table } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useAsyncState } from "@/hooks/use-async-state";
import { backofficeApi } from "@/lib/api/backoffice";
import { CustomsCaseStatus, CustomsEventSource } from "@/lib/api/contracts";

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "Pendiente revisión",
  UNDER_REVIEW: "En revisión",
  RELEASED: "Liberado",
  HELD: "Retenido",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  OFFICIAL_PORTAL: "Portal Oficial",
  AUTHORIZED_INTEGRATION: "Integración Autorizada",
};

export default function CustomsCaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = use(params);
  const { pushToast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status Change State
  const [newStatus, setNewStatus] = useState<CustomsCaseStatus | "">("");

  // Event Record State
  const [eventSource, setEventSource] = useState<CustomsEventSource | "">("");
  const [eventDate, setEventDate] = useState("");
  const [eventDescription, setEventDescription] = useState("");

  const caseResource = useAsyncState(
    useCallback(() => backofficeApi.getCustomsCase(caseId), [caseId]),
  );

  const handleChangeStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatus) return;

    try {
      setIsSubmitting(true);
      await backofficeApi.changeCustomsCaseStatus(caseId, {
        status: newStatus,
      });
      pushToast("Estado actualizado exitosamente");
      setNewStatus("");
      await caseResource.refresh();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventSource || !eventDate || !eventDescription) return;

    try {
      setIsSubmitting(true);
      // Constructing Date in ISO Format
      const dateISO = new Date(eventDate).toISOString();

      await backofficeApi.recordCustomsCaseEvent(caseId, {
        source: eventSource,
        eventDate: dateISO,
        description: eventDescription,
      });
      pushToast("Evento registrado exitosamente");
      setEventSource("");
      setEventDate("");
      setEventDescription("");
      await caseResource.refresh();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (caseResource.status === "loading") {
    return <LoadingState label="Cargando detalles del caso..." />;
  }

  if (caseResource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar el caso"
        description={caseResource.error.message}
        onRetry={() => void caseResource.refresh()}
      />
    );
  }

  const customsCase = caseResource.data;

  return (
    <PermissionBoundary
      requiredPermissions={["customs.read"]}
      fallback={
        <ErrorState
          title="Acceso no autorizado"
          description="Tu sesión no tiene permisos para ver este caso."
        />
      }
    >
      <div className="page-stack">
        <section className="page-header">
          <div>
            <h1>Caso Aduanero: {customsCase.caseNumber}</h1>
            <p>
              Estado actual:{" "}
              <Badge>{STATUS_LABELS[customsCase.status] || customsCase.status}</Badge>
            </p>
          </div>
          <div>
            <Link href="/customs/cases" className="ui-button ui-button--outline">
              Volver a la lista
            </Link>
          </div>
        </section>

        <PermissionBoundary requiredPermissions={["customs.manage"]}>
          <div className="layout-sidebar">
            <div className="layout-sidebar__main">
              <Card>
                <div className="card-header">
                  <h2>Registrar evento</h2>
                </div>
                <form className="ui-form" onSubmit={handleRecordEvent}>
                  <div className="ui-form__fields">
                    <FormField label="Fuente *">
                      <Select
                        value={eventSource}
                        onChange={(e) => setEventSource(e.target.value as CustomsEventSource)}
                        disabled={isSubmitting}
                      >
                        <option value="">Seleccione...</option>
                        {Object.entries(SOURCE_LABELS).map(([val, lbl]) => (
                          <option key={val} value={val}>
                            {lbl}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Fecha del evento *">
                      <Input
                        type="datetime-local"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </FormField>
                    <FormField label="Descripción *">
                      <Input
                        value={eventDescription}
                        onChange={(e) => setEventDescription(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </FormField>
                  </div>
                  <div className="ui-form__actions">
                    <button
                      type="submit"
                      className="ui-button ui-button--primary"
                      disabled={isSubmitting || !eventSource || !eventDate || !eventDescription}
                    >
                      Registrar evento
                    </button>
                  </div>
                </form>
              </Card>

              <Card>
                <div className="card-header">
                  <h2>Eventos registrados</h2>
                </div>
                {!customsCase.events || customsCase.events.length === 0 ? (
                  <p className="text-secondary" style={{ padding: "1rem" }}>
                    No hay eventos registrados.
                  </p>
                ) : (
                  <Table
                    columns={[
                      "Fecha",
                      "Fuente",
                      "Descripción",
                    ]}
                    rows={customsCase.events.map((ev) => [
                      new Date(ev.eventDate).toLocaleString(),
                      SOURCE_LABELS[ev.source] || ev.source,
                      ev.description,
                    ])}
                  />
                )}
              </Card>
            </div>

            <div className="layout-sidebar__side">
              <Card>
                <div className="card-header">
                  <h2>Cambiar estado</h2>
                </div>
                <form className="ui-form" onSubmit={handleChangeStatus}>
                  <div className="ui-form__fields">
                    <FormField label="Nuevo estado *">
                      <Select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as CustomsCaseStatus)}
                        disabled={isSubmitting}
                      >
                        <option value="">Seleccione...</option>
                        {Object.entries(STATUS_LABELS).map(([val, lbl]) => (
                          <option key={val} value={val}>
                            {lbl}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </div>
                  <div className="ui-form__actions">
                    <button
                      type="submit"
                      className="ui-button ui-button--primary"
                      disabled={isSubmitting || !newStatus || newStatus === customsCase.status}
                      style={{ width: "100%" }}
                    >
                      Actualizar estado
                    </button>
                  </div>
                </form>
              </Card>
            </div>
          </div>
        </PermissionBoundary>
      </div>
    </PermissionBoundary>
  );
}
