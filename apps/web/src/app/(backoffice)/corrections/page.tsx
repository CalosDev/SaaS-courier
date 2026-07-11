"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { backofficeApi } from "@/lib/api/backoffice";
import type { CorrectionRequest } from "@/lib/api/contracts";

const correctionTargetTypes = [
  "PACKAGE",
  "PREALERT",
  "MANIFEST",
  "CUSTOMS_CASE",
  "INVOICE",
] as const;

const createCorrectionSchema = z.object({
  targetId: z.string().min(1, "El ID del objeto a corregir es requerido"),
  targetType: z.enum(correctionTargetTypes),
  reason: z
    .string()
    .min(5, "Describe el motivo de la correccion (minimo 5 caracteres)"),
  field: z.string().min(1, "Indica el campo a corregir"),
  newValue: z.string().min(1, "Indica el nuevo valor"),
});

type CreateCorrectionForm = z.infer<typeof createCorrectionSchema>;

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

export default function CorrectionsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { pushToast } = useToast();

  const {
    data: corrections,
    error,
    isLoading,
    mutate: refetch,
  } = useSWR<CorrectionRequest[]>("/corrections", () =>
    backofficeApi.listCorrections(),
  );

  const createForm = useForm<CreateCorrectionForm>({
    resolver: zodResolver(createCorrectionSchema),
    defaultValues: { targetType: "PACKAGE" },
  });

  async function onCreateSubmit(values: CreateCorrectionForm) {
    try {
      await backofficeApi.createCorrection({
        targetType: values.targetType,
        targetId: values.targetId,
        reason: values.reason,
        proposedData: { [values.field]: values.newValue },
      });
      pushToast("Solicitud de correccion creada.");
      createForm.reset({ targetType: "PACKAGE" });
      setShowCreate(false);
      await refetch();
    } catch (err) {
      pushToast(
        err instanceof ApiError
          ? err.message
          : "No fue posible crear la solicitud.",
      );
    }
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Solicitudes de Correccion</h1>
          <p>Gestion de correcciones controladas para objetos operativos.</p>
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
          <ErrorState
            title="Error al cargar solicitudes"
            description={error.message}
            onRetry={() => void refetch()}
          />
        ) : !corrections || corrections.length === 0 ? (
          <EmptyState
            title="No hay solicitudes de correccion"
            description="Crea una cuando necesites modificar datos registrados sin sobrescribir el historial original."
          />
        ) : (
          <Table
            columns={["Target", "Tipo", "Motivo", "Estado", "Fecha", "Accion"]}
            rows={corrections.map((correction) => [
              <span key={`t-${correction.id}`} className="inline-code">
                {correction.targetId}
              </span>,
              correction.targetType,
              correction.reason,
              <Badge
                key={`s-${correction.id}`}
                tone={STATUS_TONE[correction.status]}
              >
                {STATUS_LABEL[correction.status]}
              </Badge>,
              new Date(correction.createdAt).toLocaleDateString("es-DO"),
              <Link
                key={`a-${correction.id}`}
                href={`/operations/corrections/${correction.id}`}
                className="inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#dde6ed] px-4 font-medium text-[#17242d] transition-colors hover:bg-[#c8d6e0]"
              >
                Ver detalle
              </Link>,
            ])}
          />
        )}
      </Card>

      <Dialog
        open={showCreate}
        title="Nueva solicitud de correccion"
        onClose={() => {
          setShowCreate(false);
          createForm.reset({ targetType: "PACKAGE" });
        }}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreate(false);
                createForm.reset({ targetType: "PACKAGE" });
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="create-correction-form"
              disabled={createForm.formState.isSubmitting}
            >
              {createForm.formState.isSubmitting
                ? "Enviando..."
                : "Solicitar correccion"}
            </Button>
          </>
        }
      >
        <form
          id="create-correction-form"
          className="form-grid"
          onSubmit={createForm.handleSubmit(onCreateSubmit)}
        >
          <FormField
            label="Tipo de objeto"
            error={createForm.formState.errors.targetType?.message}
          >
            <Select {...createForm.register("targetType")}>
              <option value="PACKAGE">Paquete</option>
              <option value="PREALERT">Prealerta</option>
              <option value="MANIFEST">Manifiesto</option>
              <option value="CUSTOMS_CASE">Caso aduanal</option>
              <option value="INVOICE">Factura</option>
            </Select>
          </FormField>
          <FormField
            label="ID del objeto"
            error={createForm.formState.errors.targetId?.message}
          >
            <Input
              {...createForm.register("targetId")}
              placeholder="UUID del recurso a corregir"
            />
          </FormField>
          <FormField
            label="Campo a corregir"
            error={createForm.formState.errors.field?.message}
          >
            <Input
              {...createForm.register("field")}
              placeholder="Ej: weightLb, dimensions"
            />
          </FormField>
          <FormField
            label="Nuevo valor"
            error={createForm.formState.errors.newValue?.message}
          >
            <Input
              {...createForm.register("newValue")}
              placeholder="El valor corregido"
            />
          </FormField>
          <FormField
            label="Motivo de la correccion"
            error={createForm.formState.errors.reason?.message}
          >
            <Textarea
              {...createForm.register("reason")}
              rows={3}
              placeholder="Describe por que se requiere esta correccion..."
            />
          </FormField>
        </form>
      </Dialog>
    </div>
  );
}
