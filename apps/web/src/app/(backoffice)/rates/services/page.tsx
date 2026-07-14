"use client";

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
import { useAsyncState } from "@/hooks/use-async-state";
import { backofficeApi } from "@/lib/api/backoffice";
import { ApiError } from "@/lib/api/api-error";

export default function ServicesPage() {
  const [page, setPage] = useState(1);
  const [isActive, setIsActive] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resource = useAsyncState(
    useCallback(
      () =>
        backofficeApi.listServices({
          page,
          pageSize: 10,
          isActive:
            isActive === ""
              ? undefined
              : isActive === "true"
                ? true
                : false,
        }),
      [isActive, page],
    ),
  );

  async function submitService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setMessage(null);
    setError(null);

    const payload = {
      code: String(formData.get("code") || ""),
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || "") || null,
      isActive: formData.get("isActive") === "on",
    };

    try {
      await backofficeApi.createService(payload);
      setMessage("Servicio creado.");
      form.reset();
      await resource.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible guardar.");
    }
  }

  if (resource.status === "loading") {
    return <LoadingState label="Cargando servicios..." />;
  }

  if (resource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar servicios"
        description={resource.error.message}
        onRetry={() => void resource.refresh()}
      />
    );
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Catálogo de Servicios</h1>
          <p>Gestiona los servicios de envío ofertados (Express, Marítimo, Aéreo).</p>
        </div>
      </section>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        <div className="filters-row">
          <FormField label="Estado">
            <Select
              value={isActive}
              onChange={(event) => setIsActive(event.target.value)}
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </Select>
          </FormField>
        </div>
      </Card>

      <Card>
        <Table
          columns={["Código", "Nombre", "Estado", "Acción"]}
          rows={resource.data.items.map((service) => [
            service.code,
            service.name,
            service.isActive ? "Activo" : "Inactivo",
            <Button
              key={service.id}
              variant="secondary"
              disabled
            >
              Editar (Pronto)
            </Button>,
          ])}
        />
        <Pagination
          page={resource.data.pagination.page}
          totalPages={resource.data.pagination.totalPages}
          onPageChange={setPage}
        />
      </Card>

      <section className="content-grid">
        <Card>
          <h2>Nuevo servicio</h2>
          <form className="form-grid" onSubmit={(e) => void submitService(e)}>
            <FormField label="Código (ej. EXP)">
              <Input name="code" required />
            </FormField>
            <FormField label="Nombre">
              <Input name="name" required />
            </FormField>
            <FormField label="Descripción">
              <Input name="description" />
            </FormField>
            <label className="toggle-row">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={true}
              />
              <span>Activo</span>
            </label>
            <Button type="submit">Crear servicio</Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
