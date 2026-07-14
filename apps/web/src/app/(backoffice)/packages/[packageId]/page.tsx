"use client";

import { use, useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { PermissionBoundary } from "@/components/auth/permission-boundary";
import { PackageDocumentsSection } from "@/components/packages/package-documents-section";
import { PackageCustomerSelector } from "@/components/packages/package-customer-selector";
import { CarrierEventsSection } from "@/components/packages/carrier-events-section";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncState } from "@/hooks/use-async-state";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import type { PackageDetail } from "@/lib/api/contracts";
import { useAuth } from "@/lib/auth/auth-provider";
import { hasEveryPermission, hasPermission } from "@/lib/permissions";
import {
  PACKAGE_SOURCE_LABELS,
  PACKAGE_STATUS_LABELS,
  getPackageStatusTone,
} from "@/lib/packages";

export default function PackageDetailPage({
  params,
}: {
  params: Promise<{ packageId: string }>;
}) {
  const { packageId } = use(params);
  const { state } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const resource = useAsyncState(
    useCallback(() => backofficeApi.getPackage(packageId), [packageId]),
  );

  const canManage =
    state.status === "authenticated" &&
    hasPermission(state.permissionCodes, "packages.manage");
  const canReadDocuments =
    state.status === "authenticated" &&
    hasPermission(state.permissionCodes, "package_documents.read");
  const canManageDocuments =
    state.status === "authenticated" &&
    hasPermission(state.permissionCodes, "package_documents.manage");
  const canReadCarrierEvents =
    state.status === "authenticated" &&
    hasPermission(state.permissionCodes, "carriers.read");
  const canOpenReception =
    state.status === "authenticated" &&
    hasEveryPermission(state.permissionCodes, [
      "packages.read",
      "packages.receive",
      "facilities.read",
      "organizations.read",
    ]);

  const readOnly =
    resource.status === "success" &&
    (resource.data.status !== "RECEPTION_PENDING" || !canManage);
  const linkedToPrealert =
    resource.status === "success" && resource.data.prealert !== null;

  async function handleUpdate(payload: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await backofficeApi.updatePackage(packageId, payload);
      setMessage("Paquete actualizado.");
      await resource.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "No fue posible actualizar el paquete.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await backofficeApi.cancelPackage(packageId, cancelReason.trim());
      setMessage("Paquete cancelado.");
      setCancelOpen(false);
      setCancelReason("");
      await resource.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "No fue posible cancelar el paquete.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const detailMetadata = useMemo(() => {
    if (resource.status !== "success") {
      return null;
    }

    return [
      {
        label: "Origen",
        value: PACKAGE_SOURCE_LABELS[resource.data.source],
      },
      {
        label: "Registrado por",
        value: resource.data.registeredBy.displayName,
      },
      {
        label: "Registrado",
        value: resource.data.registeredAt.slice(0, 10),
      },
      {
        label: "Prealerta",
        value: resource.data.prealert?.prealertCode || "No aplica",
      },
    ];
  }, [resource]);

  if (resource.status === "loading") {
    return <LoadingState label="Cargando paquete..." />;
  }

  if (resource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar el paquete"
        description={resource.error.message}
        onRetry={() => void resource.refresh()}
      />
    );
  }

  return (
    <PermissionBoundary
      requiredPermissions={["packages.read"]}
      fallback={
        <ErrorState
          title="Acceso no autorizado"
          description="Tu sesion no tiene permisos para consultar este paquete."
        />
      }
    >
      <div className="page-stack">
        <section className="page-header">
          <div>
            <h1>{resource.data.internalTrackingNumber}</h1>
            <p>{resource.data.customer.displayName}</p>
          </div>
          <div className="actions-row">
            {canOpenReception && resource.data.status === "RECEPTION_PENDING" ? (
              <Link
                href={`/packages/${packageId}/receive`}
                className="ui-button ui-button--primary"
              >
                Recibir paquete
              </Link>
            ) : null}
            <Badge tone={getPackageStatusTone(resource.data.status)}>
              {PACKAGE_STATUS_LABELS[resource.data.status]}
            </Badge>
            <Badge tone="neutral">
              {PACKAGE_SOURCE_LABELS[resource.data.source]}
            </Badge>
          </div>
        </section>

        {message ? <Alert tone="success">{message}</Alert> : null}
        {resource.data.status === "CANCELLED" ? (
          <Alert tone="warning">
            Este paquete esta cancelado y permanece en solo lectura.
          </Alert>
        ) : null}
        {resource.data.status === "RECEIVED_AT_ORIGIN" ? (
          <Alert tone="success">
            La recepcion fisica fue confirmada y el registro permanece en solo
            lectura.
          </Alert>
        ) : null}
        {linkedToPrealert ? (
          <Alert tone="info">
            Este paquete proviene de una prealerta. El cliente y el tracking
            externo permanecen bloqueados.
          </Alert>
        ) : null}

        <section className="content-grid">
          <Card>
            <h2>{readOnly ? "Detalle del paquete" : "Editar paquete"}</h2>
            {error ? <Alert tone="error">{error}</Alert> : null}
            <PackageEditor
              key={`${resource.data.id}:${resource.data.updatedAt}:${resource.data.status}`}
              packageRecord={resource.data}
              readOnly={readOnly}
              submitting={submitting}
              onSubmit={handleUpdate}
            />
          </Card>

          <Card>
            <h2>Resumen operativo</h2>
            <ul className="detail-list">
              {detailMetadata?.map((entry) => (
                <li key={entry.label}>
                  <span>{entry.label}</span>
                  <strong>{entry.value}</strong>
                </li>
              ))}
              <li>
                <span>Tracking externo</span>
                <strong>{resource.data.externalTrackingNumber}</strong>
              </li>
              <li>
                <span>Cancelado por</span>
                <strong>{resource.data.cancelledBy?.displayName || "No aplica"}</strong>
              </li>
              <li>
                <span>Motivo</span>
                <strong>{resource.data.cancellationReason || "No aplica"}</strong>
              </li>
              <li>
                <span>Fecha de cancelacion</span>
                <strong>{resource.data.cancelledAt?.slice(0, 10) || "No aplica"}</strong>
              </li>
            </ul>
          </Card>
        </section>

        {canReadDocuments ? (
          <Card>
            <h2>Documentos del paquete</h2>
            <PackageDocumentsSection
              packageId={packageId}
              canManage={canManageDocuments}
            />
          </Card>
        ) : null}

        {canReadCarrierEvents ? (
          <Card>
            <h2>Eventos del carrier</h2>
            <CarrierEventsSection packageId={packageId} />
          </Card>
        ) : null}

        {canManage && resource.data.status === "RECEPTION_PENDING" ? (
          <Card>
            <div className="actions-row">
              <div>
                <h2>Cancelar paquete</h2>
                <p>
                  La cancelacion libera el tracking activo y, si aplica,
                  reabre la prealerta vinculada.
                </p>
              </div>
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                Cancelar paquete
              </Button>
            </div>
          </Card>
        ) : null}

        <Dialog
          open={cancelOpen}
          title="Cancelar paquete"
          onClose={() => {
            if (!submitting) {
              setCancelOpen(false);
            }
          }}
          actions={
            <>
              <Button
                variant="secondary"
                onClick={() => setCancelOpen(false)}
                disabled={submitting}
              >
                Volver
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleCancel()}
                disabled={submitting || cancelReason.trim().length < 3}
              >
                {submitting ? "Cancelando..." : "Confirmar cancelacion"}
              </Button>
            </>
          }
        >
          <FormField label="Motivo">
            <Textarea
              rows={4}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Explica por que el registro operativo debe cancelarse."
            />
          </FormField>
        </Dialog>
      </div>
    </PermissionBoundary>
  );
}

function PackageEditor({
  packageRecord,
  readOnly,
  submitting,
  onSubmit,
}: {
  packageRecord: PackageDetail;
  readOnly: boolean;
  submitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const linkedToPrealert = packageRecord.prealert !== null;
  const [customerId, setCustomerId] = useState(packageRecord.customer.id);
  const [customerLabel, setCustomerLabel] = useState(
    `${packageRecord.customer.customerCode} · ${packageRecord.customer.displayName}`,
  );
  const [externalTrackingNumber, setExternalTrackingNumber] = useState(
    packageRecord.externalTrackingNumber,
  );
  const [notes, setNotes] = useState(packageRecord.notes || "");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = linkedToPrealert
      ? buildLinkedUpdatePayload(notes)
      : buildManualUpdatePayload(customerId, externalTrackingNumber, notes);

    await onSubmit(payload);
  }

  return (
    <form className="form-grid" onSubmit={(event) => void handleSubmit(event)}>
      {linkedToPrealert ? (
        <>
          <FormField label="Cliente">
            <Input value={packageRecord.customer.displayName} disabled />
          </FormField>
          <FormField label="Tracking externo">
            <Input value={packageRecord.externalTrackingNumber} disabled />
          </FormField>
        </>
      ) : (
        <>
          <PackageCustomerSelector
            value={customerId}
            selectedLabel={customerLabel}
            onChange={(value) => {
              setCustomerId(value);

              if (value !== packageRecord.customer.id) {
                setCustomerLabel("");
              }
            }}
            disabled={readOnly || submitting}
          />

          <FormField label="Tracking externo">
            <Input
              value={externalTrackingNumber}
              onChange={(event) => setExternalTrackingNumber(event.target.value)}
              disabled={readOnly || submitting}
              required
            />
          </FormField>
        </>
      )}

      <FormField label="Notas (opcional)">
        <Textarea
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={readOnly || submitting}
        />
      </FormField>

      {!readOnly ? (
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando..." : "Guardar cambios"}
        </Button>
      ) : null}
    </form>
  );
}

function buildManualUpdatePayload(
  customerId: string,
  externalTrackingNumber: string,
  notes: string,
) {
  return {
    customerId,
    externalTrackingNumber: externalTrackingNumber.trim(),
    notes: normalizeNotes(notes),
  };
}

function buildLinkedUpdatePayload(notes: string) {
  return {
    notes: normalizeNotes(notes),
  };
}

function normalizeNotes(value: string): string | null {
  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}
