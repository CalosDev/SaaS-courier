"use client";

import { useCallback, useMemo, useState } from "react";

import { PermissionBoundary } from "@/components/auth/permission-boundary";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { useAsyncState } from "@/hooks/use-async-state";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import {
  WAREHOUSE_LOCATION_TYPE_LABELS,
} from "@/lib/inventory";

export default function InventoryLocationsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [type, setType] = useState("");
  const [isActive, setIsActive] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const locationsResource = useAsyncState(
    useCallback(
      () =>
        backofficeApi.listInventoryLocations({
          page,
          pageSize: 10,
          q: q || undefined,
          facilityId: facilityId || undefined,
          type: type || undefined,
          isActive:
            isActive === ""
              ? undefined
              : isActive === "true"
                ? true
                : false,
        }),
      [facilityId, isActive, page, q, type],
    ),
  );

  const facilitiesResource = useAsyncState(
    useCallback(
      () => backofficeApi.listFacilities({ page: 1, pageSize: 100, isActive: true }),
      [],
    ),
  );

  const selectedLocation = useMemo(
    () =>
      locationsResource.status === "success"
        ? locationsResource.data.items.find((item) => item.id === selectedLocationId) ?? null
        : null,
    [locationsResource, selectedLocationId],
  );

  async function submitLocation(
    event: React.FormEvent<HTMLFormElement>,
    locationId?: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage(null);
    setError(null);
    const formData = new FormData(form);
    const payload = {
      facilityId: String(formData.get("facilityId") || ""),
      code: String(formData.get("code") || ""),
      name: String(formData.get("name") || ""),
      type: String(formData.get("type") || ""),
      description: String(formData.get("description") || "") || null,
      isActive: formData.get("isActive") === "on",
    };

    try {
      if (locationId) {
        await backofficeApi.updateInventoryLocation(locationId, {
          code: payload.code,
          name: payload.name,
          type: payload.type,
          description: payload.description,
          isActive: payload.isActive,
        });
        setMessage("Ubicación actualizada.");
      } else {
        await backofficeApi.createInventoryLocation(payload);
        setMessage("Ubicación creada.");
        form.reset();
      }

      await locationsResource.refresh();
    } catch (error) {
      setError(
        error instanceof ApiError ? error.message : "No fue posible guardar la ubicación.",
      );
    }
  }

  if (locationsResource.status === "loading" || facilitiesResource.status === "loading") {
    return <LoadingState label="Cargando ubicaciones..." />;
  }

  if (locationsResource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar ubicaciones"
        description={locationsResource.error.message}
        onRetry={() => void locationsResource.refresh()}
      />
    );
  }

  if (facilitiesResource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar facilities"
        description={facilitiesResource.error.message}
        onRetry={() => void facilitiesResource.refresh()}
      />
    );
  }

  const facilities = facilitiesResource.data.items.map((facility) => ({
    value: facility.id,
    label: `${facility.code} · ${facility.name}`,
  }));

  return (
    <PermissionBoundary
      requiredPermissions={["inventory.read"]}
      fallback={
        <ErrorState
          title="Acceso no autorizado"
          description="Tu sesión no tiene permisos para consultar ubicaciones."
        />
      }
    >
      <div className="page-stack">
        <section className="page-header">
          <div>
            <h1>Ubicaciones de almacén</h1>
            <p>
              Catálogo operativo de posiciones internas por facility para inventario
              recibido.
            </p>
          </div>
        </section>

        {message ? <Alert tone="success">{message}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Card>
          <div className="filters-row">
            <FormField label="Buscar">
              <Input value={q} onChange={(event) => setQ(event.target.value)} />
            </FormField>
            <FormField label="Facility">
              <Select
                value={facilityId}
                onChange={(event) => setFacilityId(event.target.value)}
              >
                <option value="">Todas</option>
                {facilities.map((facility) => (
                  <option key={facility.value} value={facility.value}>
                    {facility.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Tipo">
              <Select value={type} onChange={(event) => setType(event.target.value)}>
                <option value="">Todos</option>
                {Object.entries(WAREHOUSE_LOCATION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Estado">
              <Select
                value={isActive}
                onChange={(event) => setIsActive(event.target.value)}
              >
                <option value="">Todos</option>
                <option value="true">Activas</option>
                <option value="false">Inactivas</option>
              </Select>
            </FormField>
          </div>
        </Card>

        <Card>
          {locationsResource.data.items.length === 0 ? (
            <EmptyState
              title="No hay ubicaciones"
              description="Crea posiciones internas para empezar a ubicar paquetes recibidos."
            />
          ) : (
            <Table
              columns={["Facility", "Código", "Nombre", "Tipo", "Estado", "Acción"]}
              rows={locationsResource.data.items.map((item) => [
                `${item.facility.code} · ${item.facility.name}`,
                item.code,
                item.name,
                WAREHOUSE_LOCATION_TYPE_LABELS[item.type],
                item.isActive ? "Activa" : "Inactiva",
                <Button
                  key={item.id}
                  variant="secondary"
                  onClick={() => setSelectedLocationId(item.id)}
                >
                  Editar
                </Button>,
              ])}
            />
          )}

          <Pagination
            page={locationsResource.data.pagination.page}
            totalPages={locationsResource.data.pagination.totalPages}
            onPageChange={setPage}
          />
        </Card>

        <section className="content-grid">
          <PermissionBoundary requiredPermissions={["inventory.manage"]}>
            <Card>
              <h2>Nueva ubicación</h2>
              <LocationForm facilities={facilities} onSubmit={submitLocation} />
            </Card>
            <Card>
              <h2>Detalle</h2>
              {selectedLocation ? (
                <LocationForm
                  facilities={facilities}
                  location={selectedLocation}
                  onSubmit={(event) => void submitLocation(event, selectedLocation.id)}
                />
              ) : (
                <p>Selecciona una ubicación para editarla.</p>
              )}
            </Card>
          </PermissionBoundary>
        </section>
      </div>
    </PermissionBoundary>
  );
}

function LocationForm({
  facilities,
  location,
  onSubmit,
}: {
  facilities: Array<{ value: string; label: string }>;
  location?: import("@/lib/api/contracts").WarehouseLocation | null;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  return (
    <form className="form-grid" onSubmit={(event) => void onSubmit(event)}>
      <FormField label="Facility">
        <Select
          name="facilityId"
          defaultValue={location?.facility.id || facilities[0]?.value || ""}
          disabled={Boolean(location)}
        >
          {facilities.map((facility) => (
            <option key={facility.value} value={facility.value}>
              {facility.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Código">
        <Input name="code" defaultValue={location?.code || ""} required />
      </FormField>
      <FormField label="Nombre">
        <Input name="name" defaultValue={location?.name || ""} required />
      </FormField>
      <FormField label="Tipo">
        <Select name="type" defaultValue={location?.type || "SHELF"}>
          {Object.entries(WAREHOUSE_LOCATION_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Descripción">
        <Input name="description" defaultValue={location?.description || ""} />
      </FormField>
      <label className="toggle-row">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={location?.isActive ?? true}
        />
        <span>Activa</span>
      </label>
      <Button type="submit">
        {location ? "Guardar cambios" : "Crear ubicación"}
      </Button>
    </form>
  );
}
