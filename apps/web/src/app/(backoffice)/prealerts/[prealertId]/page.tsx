"use client";

import { use, useCallback, useMemo, useState } from "react";

import { PermissionBoundary } from "@/components/auth/permission-boundary";
import {
  PrealertForm,
  type PrealertSubmitPayload,
} from "@/components/prealerts/prealert-form";
import { ExternalTrackingTimeline } from "@/components/prealerts/external-tracking-timeline";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncState } from "@/hooks/use-async-state";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import { useAuth } from "@/lib/auth/auth-provider";
import { hasPermission } from "@/lib/permissions";
import {
  PREALERT_INVOICE_STATUS_LABELS,
  PREALERT_STATUS_LABELS,
  formatPrealertMoney,
  getPrealertInvoiceTone,
  getPrealertStatusTone,
} from "@/lib/prealerts";

export default function PrealertDetailPage({
  params,
}: {
  params: Promise<{ prealertId: string }>;
}) {
  const { prealertId } = use(params);
  const { state } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const resource = useAsyncState(
    useCallback(() => backofficeApi.getPrealert(prealertId), [prealertId]),
  );

  const canManage =
    state.status === "authenticated" &&
    hasPermission(state.permissionCodes, "prealerts.manage");

  const readOnly =
    resource.status === "success" &&
    (resource.data.status === "CANCELLED" ||
      resource.data.status === "MATCHED" ||
      !canManage);

  const initialValues =
    resource.status === "success"
      ? {
          customerId: resource.data.customer.id,
          customerLabel: `${resource.data.customer.customerCode} · ${resource.data.customer.displayName}`,
          externalTrackingNumber: resource.data.externalTrackingNumber,
          carrierName: resource.data.carrierName || "",
          storeName: resource.data.storeName,
          purchaseDate: resource.data.purchaseDate || "",
          description: resource.data.description,
          quantity: String(resource.data.quantity),
          declaredValue: resource.data.declaredValue,
          currencyCode: resource.data.currencyCode,
          invoiceStatus: resource.data.invoiceStatus,
          notes: resource.data.notes || "",
        }
      : undefined;

  async function handleSubmit(payload: PrealertSubmitPayload) {
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await backofficeApi.updatePrealert(prealertId, payload);
      setMessage("Prealerta actualizada.");
      await resource.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "No fue posible actualizar la prealerta.",
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
      await backofficeApi.cancelPrealert(prealertId, cancelReason);
      setMessage("Prealerta cancelada.");
      setCancelOpen(false);
      setCancelReason("");
      await resource.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "No fue posible cancelar la prealerta.",
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
        label: "Codigo",
        value: resource.data.prealertCode,
      },
      {
        label: "Cliente",
        value: resource.data.customer.displayName,
      },
      {
        label: "Creada por",
        value: resource.data.createdBy.displayName,
      },
      {
        label: "Creada",
        value: resource.data.createdAt.slice(0, 10),
      },
    ];
  }, [resource]);

  if (resource.status === "loading") {
    return <LoadingState label="Cargando prealerta..." />;
  }

  if (resource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar la prealerta"
        description={resource.error.message}
        onRetry={() => void resource.refresh()}
      />
    );
  }

  return (
    <PermissionBoundary
      requiredPermissions={["prealerts.read"]}
      fallback={
        <ErrorState
          title="Acceso no autorizado"
          description="Tu sesion no tiene permisos para consultar esta prealerta."
        />
      }
    >
      <div className="page-stack">
        <section className="page-header">
          <div>
            <h1>{resource.data.prealertCode}</h1>
            <p>{resource.data.customer.displayName}</p>
          </div>
          <div className="actions-row">
            <Badge tone={getPrealertStatusTone(resource.data.status)}>
              {PREALERT_STATUS_LABELS[resource.data.status]}
            </Badge>
            <Badge tone={getPrealertInvoiceTone(resource.data.invoiceStatus)}>
              {PREALERT_INVOICE_STATUS_LABELS[resource.data.invoiceStatus]}
            </Badge>
          </div>
        </section>

        {message ? <Alert tone="success">{message}</Alert> : null}
        {resource.data.status === "MATCHED" ? (
          <Alert tone="info">
            Esta prealerta ya fue vinculada a un paquete y permanece en solo
            lectura.
          </Alert>
        ) : null}
        {resource.data.status === "CANCELLED" ? (
          <Alert tone="warning">
            Esta prealerta esta cancelada y permanece en solo lectura.
          </Alert>
        ) : null}

        <section className="content-grid">
          <Card>
            <h2>{readOnly ? "Detalle de la prealerta" : "Editar prealerta"}</h2>
            <PrealertForm
              key={`${resource.data.id}:${resource.data.updatedAt}:${resource.data.status}`}
              initialValues={initialValues}
              readOnly={readOnly}
              showWarning={false}
              submitting={submitting}
              error={error}
              submitLabel="Guardar cambios"
              onSubmit={canManage ? handleSubmit : undefined}
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
                <span>Tracking</span>
                <strong>{resource.data.externalTrackingNumber}</strong>
              </li>
              <li>
                <span>Paquete vinculado</span>
                <strong>
                  {resource.data.matchedPackage?.internalTrackingNumber ||
                    "No aplica"}
                </strong>
              </li>
              <li>
                <span>Valor</span>
                <strong>
                  {formatPrealertMoney(
                    resource.data.declaredValue,
                    resource.data.currencyCode,
                  )}
                </strong>
              </li>
              <li>
                <span>Cancelada por</span>
                <strong>
                  {resource.data.cancelledBy?.displayName || "No aplica"}
                </strong>
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

          <ExternalTrackingTimeline prealertId={prealertId} />
        </section>

        {canManage && resource.data.status === "PENDING_ARRIVAL" ? (
          <Card>
            <div className="actions-row">
              <div>
                <h2>Cancelar prealerta</h2>
                <p>
                  La cancelacion libera el tracking para futuras compras esperadas
                  del mismo courier.
                </p>
              </div>
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                Cancelar prealerta
              </Button>
            </div>
          </Card>
        ) : null}

        <Dialog
          open={cancelOpen}
          title="Cancelar prealerta"
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
              placeholder="Explica por que la compra esperada fue cancelada."
            />
          </FormField>
        </Dialog>
      </div>
    </PermissionBoundary>
  );
}
