"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

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

export default function RateCardsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resource = useAsyncState(
    useCallback(
      () =>
        backofficeApi.listRateCards({
          page,
          pageSize: 10,
          status: status || undefined,
        }),
      [status, page],
    ),
  );

  const servicesResource = useAsyncState(
    useCallback(() => backofficeApi.listServices({ isActive: true, pageSize: 100 }), []),
  );

  async function submitCard(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    setError(null);

    const payload = {
      serviceId: String(formData.get("serviceId") || ""),
      name: String(formData.get("name") || ""),
      segmentKey: String(formData.get("segmentKey") || "DEFAULT"),
      segmentName: String(formData.get("segmentName") || "Default"),
      calculationType: String(formData.get("calculationType") || ""),
    };

    try {
      await backofficeApi.createRateCard(payload);
      setMessage("Tarifario creado. Búscalo en la tabla para configurarlo.");
      event.currentTarget.reset();
      await resource.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible guardar.");
    }
  }

  if (resource.status === "loading" || servicesResource.status === "loading") {
    return <LoadingState label="Cargando tarifarios..." />;
  }

  if (resource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar tarifarios"
        description={resource.error.message}
        onRetry={() => void resource.refresh()}
      />
    );
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Tarifarios (Rate Cards)</h1>
          <p>Gestiona los diferentes esquemas de cobro por segmento y servicio.</p>
        </div>
      </section>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        <div className="filters-row">
          <FormField label="Estado">
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos</option>
              <option value="DRAFT">Borrador</option>
              <option value="ACTIVE">Activo</option>
              <option value="RETIRED">Retirado</option>
            </Select>
          </FormField>
        </div>
      </Card>

      <Card>
        <Table
          columns={["Nombre", "Servicio", "Segmento", "Tipo", "Estado", "Acción"]}
          rows={resource.data.items.map((card) => [
            card.name,
            card.service.code,
            card.segmentKey,
            card.calculationType,
            card.status,
            <Link key={card.id} href={`/rates/cards/${card.id}`}>
              <Button variant="secondary">Configurar</Button>
            </Link>,
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
          <h2>Nuevo Tarifario (Borrador)</h2>
          <form className="form-grid" onSubmit={(e) => void submitCard(e)}>
            <FormField label="Servicio Base">
              <Select name="serviceId" required>
                <option value="">Selecciona servicio</option>
                {servicesResource.status === "success" &&
                  servicesResource.data.items.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.code} - {srv.name}
                    </option>
                  ))}
              </Select>
            </FormField>
            <FormField label="Nombre (Interno)">
              <Input name="name" required placeholder="Ej. Standard Retail 2026" />
            </FormField>
            <FormField label="Segmento (Key)">
              <Input name="segmentKey" defaultValue="DEFAULT" required />
            </FormField>
            <FormField label="Segmento (Nombre)">
              <Input name="segmentName" defaultValue="Default" required />
            </FormField>
            <FormField label="Tipo de Cálculo">
              <Select name="calculationType" required defaultValue="PER_WEIGHT">
                <option value="FLAT">Flat (Fijo)</option>
                <option value="PER_WEIGHT">Por Peso (Lineal)</option>
                <option value="TIERED_WEIGHT">Tramos (Escalonado por peso)</option>
                <option value="PER_PIECE">Por Pieza</option>
              </Select>
            </FormField>
            <Button type="submit">Crear Tarifario</Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
