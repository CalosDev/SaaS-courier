"use client";

import { use, useState } from "react";
import useSWR from "swr";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import type { DeliveryAttemptResult, DeliveryOrder } from "@/lib/api/contracts";

export default function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const {
    data: delivery,
    error: loadError,
    isLoading,
    mutate,
  } = useSWR<DeliveryOrder>(`/deliveries/${id}`, () =>
    backofficeApi.getDelivery(id),
  );
  const [attemptResult, setAttemptResult] =
    useState<DeliveryAttemptResult>("NOT_HOME");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function run(action: () => Promise<DeliveryOrder>) {
    try {
      setSubmitting(true);
      setSubmitError(null);
      await action();
      await mutate();
    } catch (caught) {
      setSubmitError(
        caught instanceof ApiError
          ? caught.message
          : "No fue posible completar la acción.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function recordAttempt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const receiverName = String(data.get("receiverName") ?? "").trim();
    if (attemptResult === "DELIVERED" && !receiverName) {
      setSubmitError(
        "Indica el nombre del receptor para confirmar la entrega.",
      );
      return;
    }
    await run(() =>
      backofficeApi.recordDeliveryAttempt(id, {
        result: attemptResult,
        receiverName: receiverName || undefined,
        notes: String(data.get("notes") ?? "").trim() || undefined,
      }),
    );
  }

  if (isLoading) return <div className="page-stack">Cargando entrega...</div>;
  if (loadError || !delivery) {
    return (
      <div className="page-stack">
        <Alert tone="error">Error al cargar la entrega.</Alert>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Entrega {delivery.deliveryNumber}</h1>
          <p>Entrega final o retiro de paquetes.</p>
        </div>
        <Badge
          tone={
            delivery.status === "DELIVERED"
              ? "success"
              : delivery.status === "FAILED" || delivery.status === "CANCELLED"
                ? "danger"
                : "neutral"
          }
        >
          {delivery.status}
        </Badge>
      </div>
      {submitError ? <Alert tone="error">{submitError}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        {delivery.status === "DRAFT" ? (
          <Button
            onClick={() => void run(() => backofficeApi.markDeliveryReady(id))}
            disabled={submitting}
          >
            Marcar lista
          </Button>
        ) : null}
        {delivery.status === "READY" ? (
          <Button
            onClick={() => void run(() => backofficeApi.dispatchDelivery(id))}
            disabled={submitting}
          >
            Despachar
          </Button>
        ) : null}
        {delivery.status === "DRAFT" || delivery.status === "READY" ? (
          <Button
            variant="danger"
            onClick={() => void run(() => backofficeApi.cancelDelivery(id))}
            disabled={submitting}
          >
            Cancelar
          </Button>
        ) : null}
      </div>
      <div className="content-grid">
        <Card>
          <h2>Datos de entrega</h2>
          <p>
            <strong>Cliente:</strong>{" "}
            {delivery.customer?.displayName ?? delivery.customerId}
          </p>
          <p>
            <strong>Método:</strong> {delivery.method}
          </p>
          <p>
            <strong>Notas:</strong> {delivery.notes || "N/A"}
          </p>
        </Card>
        <Card>
          <h2>Paquetes</h2>
          {delivery.items.map((item) => (
            <p key={item.id} className="inline-code">
              {item.package?.internalTrackingNumber ?? item.packageId}
            </p>
          ))}
        </Card>
      </div>
      {delivery.status === "OUT_FOR_DELIVERY" ? (
        <Card>
          <h2>Registrar intento</h2>
          <form className="form-grid" onSubmit={recordAttempt}>
            <FormField label="Resultado">
              <Select
                value={attemptResult}
                onChange={(event) =>
                  setAttemptResult(event.target.value as DeliveryAttemptResult)
                }
              >
                <option value="DELIVERED">Entregado</option>
                <option value="NOT_HOME">Cliente ausente</option>
                <option value="REJECTED">Rechazado</option>
                <option value="ADDRESS_ISSUE">Problema de dirección</option>
                <option value="OTHER">Otro</option>
              </Select>
            </FormField>
            {attemptResult === "DELIVERED" ? (
              <FormField label="Receptor">
                <Input name="receiverName" maxLength={120} required />
              </FormField>
            ) : null}
            <FormField label="Notas">
              <Textarea name="notes" maxLength={1000} />
            </FormField>
            <div style={{ gridColumn: "1 / -1" }}>
              <Button type="submit" disabled={submitting}>
                Registrar intento
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
      <Card>
        <h2>Intentos</h2>
        {delivery.attempts?.length ? (
          delivery.attempts.map((attempt) => (
            <div key={attempt.id} className="py-2 border-b">
              <strong>{attempt.result}</strong>
              <span> {attempt.receiverName || "Sin receptor"}</span>
              <span>
                {" "}
                {new Date(attempt.attemptedAt).toLocaleString("es-DO")}
              </span>
            </div>
          ))
        ) : (
          <p>No hay intentos registrados.</p>
        )}
      </Card>
    </div>
  );
}
