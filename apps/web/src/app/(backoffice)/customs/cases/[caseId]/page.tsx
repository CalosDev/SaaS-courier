"use client";

import Link from "next/link";
import { use, useCallback, useState } from "react";

import { PermissionBoundary } from "@/components/auth/permission-boundary";
import { CustomsCaseStatusBadge } from "@/components/customs-cases/CustomsCaseStatusBadge";
import {
  CUSTOMS_CASE_STATUS_LABELS,
  CUSTOMS_EVENT_SOURCE_LABELS,
} from "@/components/customs-cases/customs-case-labels";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useAsyncState } from "@/hooks/use-async-state";
import { backofficeApi } from "@/lib/api/backoffice";
import type { CustomsCaseStatus, CustomsEventSource } from "@/lib/api/contracts";

export default function CustomsCaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = use(params);
  const { pushToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newStatus, setNewStatus] = useState<CustomsCaseStatus | "">("");
  const [eventSource, setEventSource] = useState<CustomsEventSource | "">("");
  const [eventDate, setEventDate] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");

  const caseResource = useAsyncState(
    useCallback(() => backofficeApi.getCustomsCase(caseId), [caseId]),
  );

  const handleChangeStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newStatus) {
      return;
    }

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

  const handleRecordEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !eventSource ||
      !eventDate ||
      !eventDescription.trim() ||
      (eventSource === "OFFICIAL_PORTAL" && !evidenceReference.trim())
    ) {
      return;
    }

    try {
      setIsSubmitting(true);
      await backofficeApi.recordCustomsCaseEvent(caseId, {
        source: eventSource,
        eventDate: new Date(eventDate).toISOString(),
        description: eventDescription.trim(),
        ...(evidenceReference.trim()
          ? { evidenceReference: evidenceReference.trim() }
          : {}),
      });
      pushToast("Evento registrado exitosamente");
      setEventSource("");
      setEventDate("");
      setEventDescription("");
      setEvidenceReference("");
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
            <div className="mt-2">
              <CustomsCaseStatusBadge status={customsCase.status} />
            </div>
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
                        onChange={(event) =>
                          setEventSource(event.target.value as CustomsEventSource)
                        }
                        disabled={isSubmitting}
                      >
                        <option value="">Seleccione...</option>
                        {Object.entries(CUSTOMS_EVENT_SOURCE_LABELS).filter(
                          ([value]) => value !== "AUTHORIZED_INTEGRATION",
                        ).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </Select>
                    </FormField>
                    <FormField label="Fecha del evento *">
                      <Input
                        type="datetime-local"
                        value={eventDate}
                        onChange={(event) => setEventDate(event.target.value)}
                        disabled={isSubmitting}
                      />
                    </FormField>
                    <FormField label="Descripción *">
                      <Input
                        value={eventDescription}
                        onChange={(event) =>
                          setEventDescription(event.target.value)
                        }
                        disabled={isSubmitting}
                      />
                    </FormField>
                    {eventSource === "OFFICIAL_PORTAL" ? (
                      <FormField label="Referencia oficial *">
                        <Input
                          value={evidenceReference}
                          onChange={(event) =>
                            setEvidenceReference(event.target.value)
                          }
                          disabled={isSubmitting}
                          placeholder="Número de consulta o expediente"
                        />
                      </FormField>
                    ) : null}
                  </div>
                  <div className="ui-form__actions">
                    <Button
                      type="submit"
                      disabled={
                        isSubmitting ||
                        !eventSource ||
                        !eventDate ||
                        !eventDescription.trim() ||
                        (eventSource === "OFFICIAL_PORTAL" &&
                          !evidenceReference.trim())
                      }
                    >
                      Registrar evento
                    </Button>
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
                    columns={["Fecha", "Fuente", "Descripción", "Evidencia"]}
                    rows={customsCase.events.map((event) => [
                      new Date(event.eventDate).toLocaleString(),
                      CUSTOMS_EVENT_SOURCE_LABELS[event.source] || event.source,
                      event.description,
                      event.evidenceReference || "—",
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
                        onChange={(event) =>
                          setNewStatus(event.target.value as CustomsCaseStatus)
                        }
                        disabled={isSubmitting}
                      >
                        <option value="">Seleccione...</option>
                        {Object.entries(CUSTOMS_CASE_STATUS_LABELS).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </Select>
                    </FormField>
                  </div>
                  <div className="ui-form__actions">
                    <Button
                      type="submit"
                      disabled={
                        isSubmitting ||
                        !newStatus ||
                        newStatus === customsCase.status
                      }
                      style={{ width: "100%" }}
                    >
                      Actualizar estado
                    </Button>
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
