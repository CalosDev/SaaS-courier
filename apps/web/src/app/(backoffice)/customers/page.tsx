"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { backofficeApi } from "@/lib/api/backoffice";
import type { Customer } from "@/lib/api/contracts";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/api-error";

const createCustomerSchema = z.object({
  type: z.enum(["INDIVIDUAL", "BUSINESS"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  businessName: z.string().optional(),
  email: z.string().email("Correo no válido").optional().or(z.literal("")),
  phone: z.string().optional(),
  mobilePhone: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (data) =>
    data.type === "BUSINESS"
      ? !!data.businessName?.trim()
      : !!(data.firstName?.trim() && data.lastName?.trim()),
  {
    message: "Para empresas es obligatorio el nombre comercial. Para personas, nombres y apellidos.",
    path: ["firstName"],
  }
);

type CreateCustomerForm = z.infer<typeof createCustomerSchema>;

const STATUS_LABEL: Record<Customer["status"], string> = {
  PENDING: "Pendiente",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  CLOSED: "Cerrado",
};

const STATUS_TONE: Record<Customer["status"], "neutral" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  ACTIVE: "success",
  SUSPENDED: "danger",
  CLOSED: "neutral",
};

export default function CustomersPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { pushToast } = useToast();

  const swrKey = `/customers?page=${page}&q=${q}&type=${type}`;
  const { data, error, isLoading, mutate: refetch } = useSWR(
    swrKey,
    () => backofficeApi.listCustomers({ page, pageSize: 10, q: q || undefined, type: type || undefined })
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateCustomerForm>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: { type: "INDIVIDUAL" },
  });

  const watchedType = watch("type");

  async function onSubmit(values: CreateCustomerForm) {
    try {
      await backofficeApi.createCustomer({
        type: values.type,
        firstName: values.firstName || undefined,
        lastName: values.lastName || undefined,
        businessName: values.businessName || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        mobilePhone: values.mobilePhone || undefined,
        notes: values.notes || undefined,
      });
      pushToast("Cliente creado exitosamente.");
      reset();
      setShowCreate(false);
      await refetch();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "No fue posible crear el cliente.");
    }
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Clientes</h1>
          <p>Base maestra de clientes y casilleros.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="button-icon" />
          Nuevo cliente
        </Button>
      </section>

      <Card>
        <div className="filters-row">
          <FormField label="Buscar">
            <Input
              value={q}
              placeholder="Código, nombre o correo..."
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
          </FormField>
          <FormField label="Tipo">
            <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="BUSINESS">Empresa</option>
            </Select>
          </FormField>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <LoadingState label="Cargando clientes..." />
        ) : error ? (
          <ErrorState title="Error al cargar clientes" description={error.message} onRetry={() => void refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No hay clientes" description="Crea tu primer cliente usando el botón 'Nuevo cliente'." />
        ) : (
          <>
            <Table
              columns={["Código", "Nombre", "Tipo", "Estado", "Acción"]}
              rows={data.items.map((customer) => [
                <span key={`code-${customer.id}`} className="inline-code">{customer.customerCode}</span>,
                customer.displayName,
                customer.type === "INDIVIDUAL" ? "Individual" : "Empresa",
                <Badge key={`status-${customer.id}`} tone={STATUS_TONE[customer.status]}>
                  {STATUS_LABEL[customer.status]}
                </Badge>,
                <Link key={`link-${customer.id}`} href={`/customers/${customer.id}`} className="inline-link">
                  Ver detalle
                </Link>,
              ])}
            />
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Dialog
        open={showCreate}
        title="Nuevo cliente"
        onClose={() => { setShowCreate(false); reset(); }}
        actions={
          <>
            <Button variant="secondary" onClick={() => { setShowCreate(false); reset(); }}>
              Cancelar
            </Button>
            <Button type="submit" form="create-customer-form" disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear cliente"}
            </Button>
          </>
        }
      >
        <form id="create-customer-form" className="form-grid" onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Tipo" error={errors.type?.message}>
            <Select {...register("type")}>
              <option value="INDIVIDUAL">Individual</option>
              <option value="BUSINESS">Empresa</option>
            </Select>
          </FormField>

          {watchedType === "INDIVIDUAL" ? (
            <>
              <FormField label="Nombres" error={errors.firstName?.message}>
                <Input {...register("firstName")} placeholder="Ej. Juan" />
              </FormField>
              <FormField label="Apellidos" error={errors.lastName?.message}>
                <Input {...register("lastName")} placeholder="Ej. Pérez" />
              </FormField>
            </>
          ) : (
            <FormField label="Nombre empresarial" error={errors.businessName?.message}>
              <Input {...register("businessName")} placeholder="Ej. Empresa S.R.L." />
            </FormField>
          )}

          <FormField label="Correo electrónico" error={errors.email?.message}>
            <Input {...register("email")} type="email" placeholder="correo@ejemplo.com" />
          </FormField>
          <FormField label="Teléfono" error={errors.phone?.message}>
            <Input {...register("phone")} placeholder="809-000-0000" />
          </FormField>
          <FormField label="Celular" error={errors.mobilePhone?.message}>
            <Input {...register("mobilePhone")} placeholder="829-000-0000" />
          </FormField>
          <FormField label="Notas internas" error={errors.notes?.message}>
            <Textarea {...register("notes")} rows={3} />
          </FormField>
        </form>
      </Dialog>
    </div>
  );
}
