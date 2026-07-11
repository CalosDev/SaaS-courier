"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import type { CorrectionRequest } from "@/lib/api/contracts";

const STATUS_LABEL: Record<CorrectionRequest["status"], string> = {
  REQUESTED: "Solicitada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  APPLIED: "Aplicada",
  CANCELLED: "Cancelada",
};

const STATUS_TONE: Record<
  CorrectionRequest["status"],
  "neutral" | "success" | "warning" | "danger"
> = {
  REQUESTED: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  APPLIED: "success",
  CANCELLED: "neutral",
};

function formatProposedData(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

export default function CorrectionDetailPage({
  params,
}: {
  params: Promise<{ correctionId: string }>;
}) {
  const resolvedParams = use(params);
  const { pushToast } = useToast();
  const [decisionReason, setDecisionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: correction,
    error,
    isLoading,
    mutate,
  } = useSWR(`/corrections/${resolvedParams.correctionId}`, () =>
    backofficeApi.getCorrection(resolvedParams.correctionId),
  );

  async function decide(action: "approve" | "reject") {
    if (!correction) {
      return;
    }

    setIsSubmitting(true);
    try {
      const updated =
        action === "approve"
          ? await backofficeApi.approveCorrection(correction.id, decisionReason)
          : await backofficeApi.rejectCorrection(correction.id, decisionReason);
      setDecisionReason("");
      await mutate(updated, { revalidate: false });
      pushToast(
        action === "approve"
          ? "Correccion aprobada."
          : "Correccion rechazada.",
      );
    } catch (err) {
      pushToast(
        err instanceof ApiError
          ? err.message
          : "No fue posible decidir la correccion.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function applyCorrection() {
    if (!correction) {
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await backofficeApi.applyCorrection(correction.id);
      await mutate(updated, { revalidate: false });
      pushToast("Correccion aplicada.");
    } catch (err) {
      pushToast(
        err instanceof ApiError
          ? err.message
          : "No fue posible aplicar la correccion.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="ui-state">Cargando correccion...</div>;
  }

  if (error || !correction) {
    return (
      <div className="ui-state ui-state--danger">
        Error al cargar la correccion.
      </div>
    );
  }

  const canDecide = correction.status === "REQUESTED";
  const canApply = correction.status === "APPROVED";

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/operations/corrections"
              className="text-gray-400 hover:text-gray-600"
              aria-label="Volver a correcciones"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1>Correccion {correction.id}</h1>
            <Badge tone={STATUS_TONE[correction.status]}>
              {STATUS_LABEL[correction.status]}
            </Badge>
          </div>
          <p>Decision controlada sin recibir tenant desde el cliente.</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-lg font-medium text-gray-900">Detalle</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-gray-500">Tipo</dt>
              <dd className="font-medium">{correction.targetType}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Target</dt>
              <dd className="inline-code">{correction.targetId}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-gray-500">Motivo</dt>
              <dd>{correction.reason}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-gray-500">Datos propuestos</dt>
              <dd>
                <pre className="mt-2 overflow-auto rounded border border-gray-200 bg-gray-50 p-3 text-sm">
                  {formatProposedData(correction.proposedData)}
                </pre>
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-lg font-medium text-gray-900">Decision</h2>
          <div className="space-y-4">
            {canDecide ? (
              <>
                <FormField label="Razon de decision">
                  <Textarea
                    value={decisionReason}
                    onChange={(event) => setDecisionReason(event.target.value)}
                    rows={4}
                    placeholder="Evidencia o justificacion operacional"
                  />
                </FormField>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void decide("approve")}
                    disabled={isSubmitting}
                  >
                    Aprobar
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => void decide("reject")}
                    disabled={isSubmitting}
                  >
                    Rechazar
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                Esta solicitud ya no esta pendiente de decision.
              </p>
            )}

            {canApply ? (
              <Button
                variant="secondary"
                onClick={() => void applyCorrection()}
                disabled={isSubmitting}
              >
                Aplicar correccion
              </Button>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
