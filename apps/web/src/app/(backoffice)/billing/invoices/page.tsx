"use client";

import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { backofficeApi } from "@/lib/api/backoffice";
import type { InvoiceRecord, InvoiceLineType } from "@/lib/api/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/api-error";

const LINE_TYPES: InvoiceLineType[] = [
  "TRANSPORT",
  "STORAGE",
  "INSURANCE",
  "DELIVERY",
  "HANDLING",
  "OTHER",
];

const lineItemSchema = z.object({
  type: z.enum([
    "TRANSPORT",
    "STORAGE",
    "INSURANCE",
    "DELIVERY",
    "HANDLING",
    "OTHER",
  ]),
  description: z.string().min(1, "La descripción es requerida"),
  quantity: z.string().min(1, "Cantidad requerida"),
  unitPriceMinor: z.string().min(1, "Precio requerido"),
});

const createInvoiceSchema = z.object({
  customerId: z.string().min(1, "Selecciona un cliente"),
  currencyCode: z.string().min(3, "Ingresa el código de moneda").max(3),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineItemSchema).min(1, "Agrega al menos una línea de factura"),
});

type CreateInvoiceForm = z.infer<typeof createInvoiceSchema>;

const STATUS_LABEL: Record<InvoiceRecord["status"], string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitida",
  PARTIALLY_PAID: "Pago Parcial",
  PAID: "Pagada",
  VOID: "Anulada",
};

const STATUS_TONE: Record<
  InvoiceRecord["status"],
  "neutral" | "success" | "warning" | "danger"
> = {
  DRAFT: "neutral",
  ISSUED: "neutral",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  VOID: "danger",
};

export default function InvoicesPage() {
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const { pushToast } = useToast();

  const swrKey = `/invoices?page=${page}`;
  const {
    data,
    error,
    isLoading,
    mutate: refetch,
  } = useSWR(swrKey, () => backofficeApi.listInvoices({ page, pageSize: 10 }));
  const invoices = data?.items ?? [];

  const { data: customersData } = useSWR("/customers-all", () =>
    backofficeApi.listCustomers({ page: 1, pageSize: 50 }),
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateInvoiceForm>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      currencyCode: "DOP",
      lines: [
        {
          type: "TRANSPORT" as const,
          description: "",
          quantity: "1",
          unitPriceMinor: "0",
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  async function onSubmit(values: CreateInvoiceForm) {
    try {
      await backofficeApi.createInvoice({
        customerId: values.customerId,
        currencyCode: values.currencyCode,
        dueDate: values.dueDate || undefined,
        notes: values.notes || undefined,
        lines: values.lines.map((l) => ({
          type: l.type,
          description: l.description,
          quantity: Number(l.quantity),
          unitPriceMinor: String(Math.round(Number(l.unitPriceMinor) * 100)),
        })),
      });
      pushToast("Factura creada como borrador.");
      reset();
      setShowCreate(false);
      await refetch();
    } catch (err) {
      pushToast(
        err instanceof ApiError
          ? err.message
          : "No fue posible crear la factura.",
      );
    }
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Facturas</h1>
          <p>Gestión de facturación a clientes.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="button-icon" />
          Nueva factura
        </Button>
      </section>

      <Card>
        {isLoading ? (
          <LoadingState label="Cargando facturas..." />
        ) : error ? (
          <ErrorState
            title="Error al cargar facturas"
            description={error.message}
            onRetry={() => void refetch()}
          />
        ) : invoices.length === 0 ? (
          <EmptyState
            title="No hay facturas"
            description="Crea la primera factura usando el botón 'Nueva factura'."
          />
        ) : (
          <>
            <Table
              columns={[
                "Nº Factura",
                "Estado",
                "Total",
                "Balance Pendiente",
                "Fecha",
              ]}
              rows={invoices.map((inv) => [
                <Link
                  key={`num-${inv.id}`}
                  href={`/billing/invoices/${inv.id}`}
                  className="inline-code"
                >
                  {inv.invoiceNumber}
                </Link>,
                <Badge key={`st-${inv.id}`} tone={STATUS_TONE[inv.status]}>
                  {STATUS_LABEL[inv.status]}
                </Badge>,
                `${inv.currencyCode} ${(Number(inv.totalMinor) / 100).toFixed(2)}`,
                `${inv.currencyCode} ${(Number(inv.balanceDueMinor) / 100).toFixed(2)}`,
                new Date(inv.createdAt).toLocaleDateString("es-DO"),
              ])}
            />
          </>
        )}
      </Card>

      <Dialog
        open={showCreate}
        title="Nueva factura"
        onClose={() => {
          setShowCreate(false);
          reset();
        }}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreate(false);
                reset();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="create-invoice-form"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creando..." : "Crear factura"}
            </Button>
          </>
        }
      >
        <form
          id="create-invoice-form"
          className="form-grid"
          onSubmit={handleSubmit(onSubmit)}
        >
          <FormField label="Cliente" error={errors.customerId?.message}>
            <Select {...register("customerId")}>
              <option value="">— Selecciona un cliente —</option>
              {(customersData?.items ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customerCode} · {c.displayName}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Moneda" error={errors.currencyCode?.message}>
            <Select {...register("currencyCode")}>
              <option value="DOP">DOP</option>
              <option value="USD">USD</option>
            </Select>
          </FormField>

          <FormField
            label="Fecha de vencimiento"
            error={errors.dueDate?.message}
          >
            <Input type="date" {...register("dueDate")} />
          </FormField>

          <FormField label="Notas" error={errors.notes?.message}>
            <Input
              {...register("notes")}
              placeholder="Observaciones opcionales"
            />
          </FormField>

          <div>
            <strong>Líneas de factura</strong>
            {errors.lines &&
              typeof errors.lines === "object" &&
              !Array.isArray(errors.lines) && (
                <span className="ui-field__error">
                  {(errors.lines as { message?: string }).message}
                </span>
              )}
          </div>

          {fields.map((field, idx) => (
            <div
              key={field.id}
              className="form-grid"
              style={{
                border: "1px solid #e0e8ee",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <FormField
                label="Tipo"
                error={errors.lines?.[idx]?.type?.message}
              >
                <Select {...register(`lines.${idx}.type`)}>
                  {LINE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                label="Descripción"
                error={errors.lines?.[idx]?.description?.message}
              >
                <Input {...register(`lines.${idx}.description`)} />
              </FormField>
              <FormField
                label="Cantidad"
                error={errors.lines?.[idx]?.quantity?.message}
              >
                <Input
                  type="number"
                  min={1}
                  {...register(`lines.${idx}.quantity`)}
                />
              </FormField>
              <FormField
                label="Precio unitario"
                error={errors.lines?.[idx]?.unitPriceMinor?.message}
              >
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  {...register(`lines.${idx}.unitPriceMinor`)}
                />
              </FormField>
              {fields.length > 1 && (
                <Button
                  variant="danger"
                  type="button"
                  onClick={() => remove(idx)}
                >
                  Eliminar línea
                </Button>
              )}
            </div>
          ))}

          <Button
            variant="secondary"
            type="button"
            onClick={() =>
              append({
                type: "TRANSPORT",
                description: "",
                quantity: "1",
                unitPriceMinor: "0",
              })
            }
          >
            + Agregar línea
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
