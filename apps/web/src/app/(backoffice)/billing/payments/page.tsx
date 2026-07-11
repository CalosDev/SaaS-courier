"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { backofficeApi } from "@/lib/api/backoffice";
import type { PaymentRecord, PaymentMethod } from "@/lib/api/contracts";
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

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CARD", "BANK_TRANSFER", "OTHER"];

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  BANK_TRANSFER: "Transferencia bancaria",
  OTHER: "Otro",
};

const createPaymentSchema = z.object({
  customerId: z.string().min(1, "Selecciona un cliente"),
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "OTHER"]),
  amount: z.string().min(1, "Ingresa el monto"),
  currencyCode: z.string().length(3, "Código de moneda de 3 letras"),
  reference: z.string().optional(),
});

type CreatePaymentForm = z.infer<typeof createPaymentSchema>;

const STATUS_LABEL: Record<PaymentRecord["status"], string> = {
  RECORDED: "Registrado",
  APPLIED: "Aplicado",
  VOID: "Anulado",
};

const STATUS_TONE: Record<PaymentRecord["status"], "neutral" | "success" | "warning" | "danger"> = {
  RECORDED: "warning",
  APPLIED: "success",
  VOID: "danger",
};

export default function PaymentsPage() {
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const { pushToast } = useToast();

  const swrKey = `/payments?page=${page}`;
  const { data, error, isLoading, mutate: refetch } = useSWR(
    swrKey,
    () => backofficeApi.listPayments({ page, pageSize: 10 })
  );
  const payments = data?.items ?? [];

  const { data: customersData } = useSWR(
    "/customers-all",
    () => backofficeApi.listCustomers({ page: 1, pageSize: 50 })
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePaymentForm>({
    resolver: zodResolver(createPaymentSchema),
    defaultValues: { method: "CASH", currencyCode: "DOP" },
  });

  async function onSubmit(values: CreatePaymentForm) {
    try {
      await backofficeApi.createPayment({
        customerId: values.customerId,
        method: values.method,
        amountMinor: String(Math.round(Number(values.amount) * 100)),
        currencyCode: values.currencyCode,
        reference: values.reference || undefined,
      });
      pushToast("Pago registrado exitosamente.");
      reset();
      setShowCreate(false);
      await refetch();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "No fue posible registrar el pago.");
    }
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Pagos</h1>
          <p>Gestión de pagos y recibos de clientes.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="button-icon" />
          Registrar pago
        </Button>
      </section>

      <Card>
        {isLoading ? (
          <LoadingState label="Cargando pagos..." />
        ) : error ? (
          <ErrorState title="Error al cargar pagos" description={error.message} onRetry={() => void refetch()} />
        ) : payments.length === 0 ? (
          <EmptyState title="No hay pagos" description="Registra el primer pago usando el botón 'Registrar pago'." />
        ) : (
          <>
            <Table
              columns={["Nº Recibo", "Estado", "Método", "Monto", "Referencia", "Fecha"]}
              rows={payments.map((pay) => [
                <span key={`num-${pay.id}`} className="inline-code">{pay.paymentNumber}</span>,
                <Badge key={`st-${pay.id}`} tone={STATUS_TONE[pay.status]}>{STATUS_LABEL[pay.status]}</Badge>,
                METHOD_LABEL[pay.method],
                `${pay.currencyCode} ${(Number(pay.amountMinor) / 100).toFixed(2)}`,
                pay.reference ?? "—",
                new Date(pay.createdAt).toLocaleDateString("es-DO"),
              ])}
            />

          </>
        )}
      </Card>

      <Dialog
        open={showCreate}
        title="Registrar pago"
        onClose={() => { setShowCreate(false); reset(); }}
        actions={
          <>
            <Button variant="secondary" onClick={() => { setShowCreate(false); reset(); }}>
              Cancelar
            </Button>
            <Button type="submit" form="create-payment-form" disabled={isSubmitting}>
              {isSubmitting ? "Registrando..." : "Registrar pago"}
            </Button>
          </>
        }
      >
        <form id="create-payment-form" className="form-grid" onSubmit={handleSubmit(onSubmit)}>
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

          <FormField label="Método de pago" error={errors.method?.message}>
            <Select {...register("method")}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{METHOD_LABEL[m]}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Monto (en unidad principal, ej. DOP 100.00)" error={errors.amount?.message}>
            <Input type="number" step="0.01" min="0.01" {...register("amount")} placeholder="0.00" />
          </FormField>

          <FormField label="Moneda" error={errors.currencyCode?.message}>
            <Select {...register("currencyCode")}>
              <option value="DOP">DOP</option>
              <option value="USD">USD</option>
            </Select>
          </FormField>

          <FormField label="Referencia (cheque, voucher, etc.)" error={errors.reference?.message}>
            <Input {...register("reference")} placeholder="Opcional" />
          </FormField>
        </form>
      </Dialog>
    </div>
  );
}
