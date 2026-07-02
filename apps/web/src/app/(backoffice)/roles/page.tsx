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
import { Table } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncState } from "@/hooks/use-async-state";
import { backofficeApi } from "@/lib/api/backoffice";
import { ApiError } from "@/lib/api/api-error";

export default function RolesPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resource = useAsyncState(
    useCallback(
      () => backofficeApi.listRoles({ page, pageSize: 10, q: q || undefined }),
      [page, q],
    ),
  );

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    setError(null);

    try {
      await backofficeApi.createRole({
        code: String(formData.get("code") || ""),
        name: String(formData.get("name") || ""),
        description: String(formData.get("description") || "") || undefined,
      });
      setMessage("Rol creado.");
      event.currentTarget.reset();
      await resource.refresh();
    } catch (error) {
      setError(error instanceof ApiError ? error.message : "No fue posible crear el rol.");
    }
  }

  if (resource.status === "loading") {
    return <LoadingState label="Cargando roles..." />;
  }

  if (resource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar roles"
        description={resource.error.message}
        onRetry={() => void resource.refresh()}
      />
    );
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Roles</h1>
          <p>Catálogo operativo de acceso por courier.</p>
        </div>
      </section>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        <FormField label="Buscar">
          <Input value={q} onChange={(event) => setQ(event.target.value)} />
        </FormField>
      </Card>

      <Card>
        <Table
          columns={["Código", "Nombre", "Activo", "Sistema", "Acción"]}
          rows={resource.data.items.map((role) => [
            role.code,
            role.name,
            role.isActive ? "Sí" : "No",
            role.isSystem ? "Sí" : "No",
            <Link key={role.id} href={`/roles/${role.id}`} className="inline-link">
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
        <h2>Nuevo rol</h2>
        <form className="form-grid" onSubmit={handleCreate}>
          <FormField label="Código">
            <Input name="code" required />
          </FormField>
          <FormField label="Nombre">
            <Input name="name" required />
          </FormField>
          <FormField label="Descripción">
            <Textarea name="description" rows={4} />
          </FormField>
          <Button type="submit">Crear rol</Button>
        </form>
      </Card>
    </div>
  );
}
