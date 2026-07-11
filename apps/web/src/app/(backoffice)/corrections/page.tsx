"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { backofficeApi } from "@/lib/api/backoffice";
import type { CorrectionRequest } from "@/lib/api/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/api-error";

const createCorrectionSchema = z.object({
  targetId: z.string().min(1, "El ID del objeto a corregir es requerido"),
  targetType: z.enum(["PACKAGE", "PREALERT"]),
  reason: z.string().min(5, "Describe el motivo de la corrección (mínimo 5 caracteres)"),
  field: z.string().min(1, "Indica el campo a corregir"),
  newValue: z.string().min(1, "Indica el nuevo valor"),
});

const approveSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

type CreateCorrectionForm = z.infer<typeof createCorrectionSchema>;
type ApproveForm = z.infer<typeof approveSchema>;

const STATUS_LABEL: Record<CorrectionRequest["status"], string> = {
  REQUESTED: "Solicitada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
};

const STATUS_TONE: Record<CorrectionRequest["status"], "neutral" | "success" | "warning" | "danger"> = {
  REQUESTED: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export default function CorrectionsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [approveTarget, setApproveTarget] = useState<CorrectionRequest | null>(null);
  const { pushToast } = useToast();

  const { data: corrections, error, isLoading, mutate: refetch } = useSWR<CorrectionRequest[]>(
    "/corrections",
    () => backofficeApi.listCorrections()
  );

  const createForm = useForm<CreateCorrectionForm>({
    resolver: zodResolver(createCorrectionSchema),
    defaultValues: { targetType: "PACKAGE" },
  });

  const approveForm = useForm<ApproveForm>({
    resolver: zodResolver(approveSchema),
    defaultValues: { status: "APPROVED" },
  });

  async function onCreateSubmit(values: CreateCorrectionForm) {
    try {
      await backofficeApi.createCorrection({
        targetType: values.targetType,
        targetId: values.targetId,
        reason: values.reason,
        proposedData: { [values.field]: values.newValue },
      });
      pushToast("Solicitud de corrección creada.");
      createForm.reset();
      setShowCreate(false);
      await refetch();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "No fue posible crear la solicitud.");
    }
  }

  async function onApproveSubmit(values: ApproveForm) {
    if (!approveTarget) return;
    try {
      await backofficeApi.updateCorrection(approveTarget.id, { status: values.status });
      pushToast(values.status === "APPROVED" ? "Corrección aprobada." : "Corrección rechazada.");
      approveForm.reset();
      setApproveTarget(null);
      await refetch();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "No fue posible actualizar la corrección.");
    }
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Solicitudes de Corrección</h1>
          <p>Gestión de correcciones de medidas y datos de paquetes.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="button-icon" />
          Nueva solicitud
        </Button>
      </section>

      <Card>
        {isLoading ? (
          <LoadingState label="Cargando solicitudes..." />
        ) : error ? (
          <ErrorState title="Error al cargar solicitudes" description={error.message} onRetry={() => void refetch()} />
        ) : !corrections || corrections.length === 0 ? (
          <EmptyState title="No hay solicitudes de corrección" description="Crea una cuando necesites modificar datos registrados en un paquete." />
        ) : (
          <Table
            columns={["Target", "Tipo", "Motivo", "Estado", "Fecha", "Acción"]}
            rows={corrections.map((corr) => [
              <span key={`t-${corr.id}`} className="inline-code">{corr.targetId}</span>,
              corr.targetType,
              corr.reason,
              <Badge key={`s-${corr.id}`} tone={STATUS_TONE[corr.status]}>{STATUS_LABEL[corr.status]}</Badge>,
              new Date(corr.createdAt).toLocaleDateString("es-DO"),
              corr.status === "REQUESTED" ? (
                <Button key={`a-${corr.id}`} variant="secondary" onClick={() => setApproveTarget(corr)}>
                  Resolver
                </Button>
              ) : <span key={`na-${corr.id}`}>—</span>,
            ])}
          />
        )}
      </Card>

      {/* Modal: Crear solicitud */}
      <Dialog
        open={showCreate}
        title="Nueva solicitud de corrección"
        onClose={() => { setShowCreate(false); createForm.reset(); }}
        actions={
          <>
            <Button variant="secondary" onClick={() => { setShowCreate(false); createForm.reset(); }}>Cancelar</Button>
            <Button type="submit" form="create-correction-form" disabled={createForm.formState.isSubmitting}>
              {createForm.formState.isSubmitting ? "Enviando..." : "Solicitar corrección"}
            </Button>
          </>
        }
      >
        <form id="create-correction-form" className="form-grid" onSubmit={createForm.handleSubmit(onCreateSubmit)}>
          <FormField label="Tipo de objeto" error={createForm.formState.errors.targetType?.message}>
            <Select {...createForm.register("targetType")}>
              <option value="PACKAGE">Paquete</option>
              <option value="PREALERT">Prealerta</option>
            </Select>
          </FormField>
          <FormField label="ID del objeto" error={createForm.formState.errors.targetId?.message}>
            <Input {...createForm.register("targetId")} placeholder="UUID del paquete o prealerta" />
          </FormField>
          <FormField label="Campo a corregir" error={createForm.formState.errors.field?.message}>
            <Input {...createForm.register("field")} placeholder="Ej: weightLb, dimensions" />
          </FormField>
          <FormField label="Nuevo valor" error={createForm.formState.errors.newValue?.message}>
            <Input {...createForm.register("newValue")} placeholder="El valor corregido" />
          </FormField>
          <FormField label="Motivo de la corrección" error={createForm.formState.errors.reason?.message}>
            <Textarea {...createForm.register("reason")} rows={3} placeholder="Describe por qué se requiere esta corrección..." />
          </FormField>
        </form>
      </Dialog>

      {/* Modal: Aprobar/Rechazar */}
      <Dialog
        open={!!approveTarget}
        title={`Resolver corrección — ${approveTarget?.targetId ?? ""}`}
        onClose={() => { setApproveTarget(null); approveForm.reset(); }}
        actions={
          <>
            <Button variant="secondary" onClick={() => { setApproveTarget(null); approveForm.reset(); }}>Cancelar</Button>
            <Button type="submit" form="approve-correction-form" disabled={approveForm.formState.isSubmitting}>
              {approveForm.formState.isSubmitting ? "Guardando..." : "Confirmar resolución"}
            </Button>
          </>
        }
      >
        <form id="approve-correction-form" className="form-grid" onSubmit={approveForm.handleSubmit(onApproveSubmit)}>
          <p><strong>Motivo:</strong> {approveTarget?.reason}</p>
          <p><strong>Datos propuestos:</strong> {JSON.stringify(approveTarget?.proposedData)}</p>
          <FormField label="Decisión" error={approveForm.formState.errors.status?.message}>
            <Select {...approveForm.register("status")}>
              <option value="APPROVED">Aprobar corrección</option>
              <option value="REJECTED">Rechazar corrección</option>
            </Select>
          </FormField>
        </form>
      </Dialog>
    </div>
  );
}
