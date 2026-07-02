"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncState } from "@/hooks/use-async-state";
import { backofficeApi } from "@/lib/api/backoffice";
import { ApiError } from "@/lib/api/api-error";

export default function CustomersPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resource = useAsyncState(
    useCallback(
      () =>
      backofficeApi.listCustomers({
        page,
        pageSize: 10,
        q: q || undefined,
        type: type || undefined,
      }),
      [page, q, type],
    ),
  );

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    setError(null);

    try {
      await backofficeApi.createCustomer({
        type: String(formData.get("type") || ""),
        firstName: String(formData.get("firstName") || "") || undefined,
        lastName: String(formData.get("lastName") || "") || undefined,
        businessName: String(formData.get("businessName") || "") || undefined,
        email: String(formData.get("email") || "") || undefined,
        phone: String(formData.get("phone") || "") || undefined,
        mobilePhone: String(formData.get("mobilePhone") || "") || undefined,
        notes: String(formData.get("notes") || "") || undefined,
      });
      setMessage("Cliente creado.");
      event.currentTarget.reset();
      await resource.refresh();
    } catch (error) {
      setError(error instanceof ApiError ? error.message : "No fue posible crear el cliente.");
    }
  }

  if (resource.status === "loading") {
    return <LoadingState label="Cargando clientes..." />;
  }

  if (resource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar clientes"
        description={resource.error.message}
        onRetry={() => void resource.refresh()}
      />
    );
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Clientes</h1>
          <p>Base maestra de clientes y casilleros.</p>
        </div>
      </section>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        <div className="filters-row">
          <FormField label="Buscar">
            <Input value={q} onChange={(event) => setQ(event.target.value)} />
          </FormField>
          <FormField label="Tipo">
            <Select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">Todos</option>
              <option value="INDIVIDUAL">INDIVIDUAL</option>
              <option value="BUSINESS">BUSINESS</option>
            </Select>
          </FormField>
        </div>
      </Card>

      <Card>
        <Table
          columns={["Código", "Nombre", "Tipo", "Estado", "Acción"]}
          rows={resource.data.items.map((customer) => [
            customer.customerCode,
            customer.displayName,
            customer.type,
            customer.status,
            <Link key={customer.id} href={`/customers/${customer.id}`} className="inline-link">
              Ver detalle
            </Link>,
          ])}
        />
        <Pagination
          page={resource.data.pagination.page}
          totalPages={resource.data.pagination.totalPages}
          onPageChange={setPage}
        />
      </Card>

      <Card>
        <h2>Nuevo cliente</h2>
        <form className="form-grid" onSubmit={handleCreate}>
          <FormField label="Tipo">
            <Select name="type" defaultValue="INDIVIDUAL">
              <option value="INDIVIDUAL">INDIVIDUAL</option>
              <option value="BUSINESS">BUSINESS</option>
            </Select>
          </FormField>
          <FormField label="Nombres">
            <Input name="firstName" />
          </FormField>
          <FormField label="Apellidos">
            <Input name="lastName" />
          </FormField>
          <FormField label="Empresa">
            <Input name="businessName" />
          </FormField>
          <FormField label="Correo">
            <Input name="email" />
          </FormField>
          <FormField label="Teléfono">
            <Input name="phone" />
          </FormField>
          <FormField label="Celular">
            <Input name="mobilePhone" />
          </FormField>
          <FormField label="Notas">
            <Textarea name="notes" rows={4} />
          </FormField>
          <Button type="submit">Crear cliente</Button>
        </form>
      </Card>
    </div>
  );
}
