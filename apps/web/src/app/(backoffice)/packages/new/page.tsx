"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { PermissionBoundary } from "@/components/auth/permission-boundary";
import { PackageCustomerSelector } from "@/components/packages/package-customer-selector";
import { PendingPrealertSelector } from "@/components/packages/pending-prealert-selector";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import type { PrealertSummary } from "@/lib/api/contracts";

type PackageCreationMode = "PREALERT" | "MANUAL";

export default function NewPackagePage() {
  const router = useRouter();
  const [mode, setMode] = useState<PackageCreationMode>("PREALERT");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [customerLabel, setCustomerLabel] = useState("");
  const [externalTrackingNumber, setExternalTrackingNumber] = useState("");
  const [selectedPrealert, setSelectedPrealert] = useState<PrealertSummary | null>(
    null,
  );
  const [notes, setNotes] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload =
        mode === "PREALERT"
          ? buildPrealertPayload(selectedPrealert, notes)
          : buildManualPayload(customerId, externalTrackingNumber, notes);
      const packageRecord = await backofficeApi.createPackage(payload);
      router.push(`/packages/${packageRecord.id}`);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "No fue posible registrar el paquete.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleCustomerChange(nextCustomerId: string) {
    setCustomerId(nextCustomerId);

    if (nextCustomerId !== customerId) {
      setCustomerLabel("");
    }
  }

  return (
    <PermissionBoundary
      requiredPermissions={["packages.manage"]}
      fallback={
        <ErrorState
          title="Acceso no autorizado"
          description="Tu sesion no tiene permisos para registrar paquetes."
        />
      }
    >
      <div className="page-stack">
        <section className="page-header">
          <div>
            <h1>Registrar paquete</h1>
            <p>
              Este registro inicia la identificacion del paquete. La recepcion
              todavia no esta completada.
            </p>
          </div>
        </section>

        <Card>
          <div className="actions-row">
            <Button
              type="button"
              variant={mode === "PREALERT" ? "primary" : "secondary"}
              aria-pressed={mode === "PREALERT"}
              onClick={() => setMode("PREALERT")}
              disabled={submitting}
            >
              Registrar desde prealerta
            </Button>
            <Button
              type="button"
              variant={mode === "MANUAL" ? "primary" : "secondary"}
              aria-pressed={mode === "MANUAL"}
              onClick={() => setMode("MANUAL")}
              disabled={submitting}
            >
              Registrar manualmente
            </Button>
          </div>

          <Alert tone="warning">
            Este registro inicia la identificacion del paquete. La recepcion
            todavia no esta completada.
          </Alert>

          {error ? <Alert tone="error">{error}</Alert> : null}

          <form className="form-grid" onSubmit={(event) => void handleSubmit(event)}>
            {mode === "PREALERT" ? (
              <>
                <PendingPrealertSelector
                  value={selectedPrealert?.id || ""}
                  selectedPrealert={selectedPrealert}
                  onChange={setSelectedPrealert}
                  disabled={submitting}
                />

                {selectedPrealert ? (
                  <ul className="detail-list">
                    <li>
                      <span>Codigo</span>
                      <strong>{selectedPrealert.prealertCode}</strong>
                    </li>
                    <li>
                      <span>Tracking externo</span>
                      <strong>{selectedPrealert.externalTrackingNumber}</strong>
                    </li>
                    <li>
                      <span>Cliente</span>
                      <strong>{selectedPrealert.customer.displayName}</strong>
                    </li>
                    <li>
                      <span>Tienda</span>
                      <strong>{selectedPrealert.storeName}</strong>
                    </li>
                    <li>
                      <span>Fecha</span>
                      <strong>{selectedPrealert.createdAt.slice(0, 10)}</strong>
                    </li>
                  </ul>
                ) : null}
              </>
            ) : (
              <>
                <PackageCustomerSelector
                  value={customerId}
                  selectedLabel={customerLabel}
                  onChange={handleCustomerChange}
                  disabled={submitting}
                />

                <FormField label="Tracking externo">
                  <Input
                    value={externalTrackingNumber}
                    onChange={(event) =>
                      setExternalTrackingNumber(event.target.value)
                    }
                    placeholder="1Z-999-AA1-01-2345-6784"
                    disabled={submitting}
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
                disabled={submitting}
              />
            </FormField>

            <Button
              type="submit"
              disabled={
                submitting ||
                (mode === "PREALERT"
                  ? !selectedPrealert
                  : customerId.trim().length === 0 ||
                    externalTrackingNumber.trim().length === 0)
              }
            >
              {submitting ? "Guardando..." : "Registrar paquete"}
            </Button>
          </form>
        </Card>
      </div>
    </PermissionBoundary>
  );
}

function buildManualPayload(
  customerId: string,
  externalTrackingNumber: string,
  notes: string,
) {
  const payload: Record<string, unknown> = {
    customerId,
    externalTrackingNumber: externalTrackingNumber.trim(),
  };

  const normalizedNotes = notes.trim();

  if (normalizedNotes) {
    payload.notes = normalizedNotes;
  }

  return payload;
}

function buildPrealertPayload(selectedPrealert: PrealertSummary | null, notes: string) {
  if (!selectedPrealert) {
    throw new Error("A pending prealert must be selected");
  }

  const payload: Record<string, unknown> = {
    prealertId: selectedPrealert.id,
  };

  const normalizedNotes = notes.trim();

  if (normalizedNotes) {
    payload.notes = normalizedNotes;
  }

  return payload;
}
