"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { backofficeApi } from "@/lib/api/backoffice";
import type { OperationalHold } from "@/lib/api/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Table } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/api-error";

const createHoldSchema = z.object({
  packageId: z.string().min(1, "El ID del paquete es requerido"),
  reason: z.string().min(5, "Describe el motivo de la retención (mínimo 5 caracteres)"),
});

const releaseHoldSchema = z.object({
  releaseReason: z.string().min(5, "Describe el motivo de la liberación (mínimo 5 caracteres)"),
});

type CreateHoldForm = z.infer<typeof createHoldSchema>;
type ReleaseHoldForm = z.infer<typeof releaseHoldSchema>;

const STATUS_LABEL: Record<OperationalHold["status"], string> = {
  ACTIVE: "Activa",
  RELEASED: "Liberada",
  CANCELLED: "Cancelada",
};

const STATUS_TONE: Record<OperationalHold["status"], "neutral" | "success" | "warning" | "danger"> = {
  ACTIVE: "danger",
  RELEASED: "success",
  CANCELLED: "neutral",
};

export default function HoldsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<OperationalHold | null>(null);
  const { pushToast } = useToast();

  const { data: holds, error, isLoading, mutate: refetch } = useSWR<OperationalHold[]>(
    "/holds",
    () => backofficeApi.listHolds()
  );

  const createForm = useForm<CreateHoldForm>({
    resolver: zodResolver(createHoldSchema),
  });

  const releaseForm = useForm<ReleaseHoldForm>({
    resolver: zodResolver(releaseHoldSchema),
  });

  async function onCreateSubmit(values: CreateHoldForm) {
    try {
      await backofficeApi.createHold({ packageId: values.packageId, reason: values.reason });
      pushToast("Retención aplicada exitosamente.");
      createForm.reset();
      setShowCreate(false);
      await refetch();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "No fue posible aplicar la retención.");
    }
  }

  async function onReleaseSubmit(values: ReleaseHoldForm) {
    if (!releaseTarget) return;
    try {
      await backofficeApi.updateHold(releaseTarget.id, {
        status: "RELEASED",
        releaseReason: values.releaseReason,
      });
      pushToast("Retención liberada exitosamente.");
      releaseForm.reset();
      setReleaseTarget(null);
      await refetch();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "No fue posible liberar la retención.");
    }
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Retenciones Operativas</h1>
          <p>Gestión de paquetes retenidos en almacén.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="button-icon" />
          Aplicar retención
        </Button>
      </section>

      <Card>
        {isLoading ? (
          <LoadingState label="Cargando retenciones..." />
        ) : error ? (
          <ErrorState title="Error al cargar retenciones" description={error.message} onRetry={() => void refetch()} />
        ) : !holds || holds.length === 0 ? (
          <EmptyState title="No hay retenciones activas" description="Aplica una retención cuando un paquete requiera ser bloqueado." />
        ) : (
          <Table
            columns={["Paquete (Target)", "Motivo", "Estado", "Fecha", "Acción"]}
            rows={holds.map((hold) => [
              <span key={`t-${hold.id}`} className="inline-code">{hold.targetId}</span>,
              hold.reason,
              <Badge key={`s-${hold.id}`} tone={STATUS_TONE[hold.status]}>{STATUS_LABEL[hold.status]}</Badge>,
              new Date(hold.createdAt).toLocaleDateString("es-DO"),
              hold.status === "ACTIVE" ? (
                <Button
                  key={`a-${hold.id}`}
                  variant="secondary"
                  onClick={() => setReleaseTarget(hold)}
                >
                  Liberar
                </Button>
              ) : <span key={`na-${hold.id}`}>—</span>,
            ])}
          />
        )}
      </Card>

      {/* Modal: Crear retención */}
      <Dialog
        open={showCreate}
        title="Aplicar retención"
        onClose={() => { setShowCreate(false); createForm.reset(); }}
        actions={
          <>
            <Button variant="secondary" onClick={() => { setShowCreate(false); createForm.reset(); }}>Cancelar</Button>
            <Button type="submit" form="create-hold-form" disabled={createForm.formState.isSubmitting}>
              {createForm.formState.isSubmitting ? "Aplicando..." : "Aplicar retención"}
            </Button>
          </>
        }
      >
        <form id="create-hold-form" className="form-grid" onSubmit={createForm.handleSubmit(onCreateSubmit)}>
          <FormField label="ID del paquete" error={createForm.formState.errors.packageId?.message}>
            <Input {...createForm.register("packageId")} placeholder="UUID del paquete" />
          </FormField>
          <FormField label="Motivo de la retención" error={createForm.formState.errors.reason?.message}>
            <Textarea {...createForm.register("reason")} rows={3} placeholder="Describe el motivo..." />
          </FormField>
        </form>
      </Dialog>

      {/* Modal: Liberar retención */}
      <Dialog
        open={!!releaseTarget}
        title={`Liberar retención — ${releaseTarget?.targetId ?? ""}`}
        onClose={() => { setReleaseTarget(null); releaseForm.reset(); }}
        actions={
          <>
            <Button variant="secondary" onClick={() => { setReleaseTarget(null); releaseForm.reset(); }}>Cancelar</Button>
            <Button type="submit" form="release-hold-form" disabled={releaseForm.formState.isSubmitting}>
              {releaseForm.formState.isSubmitting ? "Liberando..." : "Confirmar liberación"}
            </Button>
          </>
        }
      >
        <form id="release-hold-form" className="form-grid" onSubmit={releaseForm.handleSubmit(onReleaseSubmit)}>
          <FormField label="Motivo de la liberación" error={releaseForm.formState.errors.releaseReason?.message}>
            <Textarea {...releaseForm.register("releaseReason")} rows={3} placeholder="Indica la razón para liberar..." />
          </FormField>
        </form>
      </Dialog>
    </div>
  );
}
