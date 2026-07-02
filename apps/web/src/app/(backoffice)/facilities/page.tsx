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

export default function FacilitiesPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [isActive, setIsActive] = useState("");
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resource = useAsyncState(
    useCallback(
      () =>
      backofficeApi.listFacilities({
        page,
        pageSize: 10,
        type: type || undefined,
        isActive:
          isActive === ""
            ? undefined
            : isActive === "true"
              ? true
              : false,
      }),
      [isActive, page, type],
    ),
  );

  const selectedResource = useAsyncState(
    useCallback(
      () =>
      selectedFacilityId
        ? backofficeApi.getFacility(selectedFacilityId)
        : Promise.resolve(null),
      [selectedFacilityId],
    ),
  );

  async function submitFacility(
    event: React.FormEvent<HTMLFormElement>,
    facilityId?: string,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    setError(null);

    const payload = {
      code: String(formData.get("code") || ""),
      name: String(formData.get("name") || ""),
      type: String(formData.get("type") || ""),
      ownershipType: String(formData.get("ownershipType") || ""),
      countryCode: String(formData.get("countryCode") || ""),
      province: String(formData.get("province") || "") || null,
      city: String(formData.get("city") || "") || null,
      addressLine1: String(formData.get("addressLine1") || "") || null,
      addressLine2: String(formData.get("addressLine2") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      email: String(formData.get("email") || "") || null,
      isCustomerFacing: formData.get("isCustomerFacing") === "on",
      isPackageOrigin: formData.get("isPackageOrigin") === "on",
      isDistributionCenter: formData.get("isDistributionCenter") === "on",
      isActive: formData.get("isActive") === "on",
    };

    try {
      if (facilityId) {
        await backofficeApi.updateFacility(facilityId, payload);
        setMessage("Facility actualizada.");
      } else {
        await backofficeApi.createFacility(payload);
        setMessage("Facility creada.");
        event.currentTarget.reset();
      }

      await resource.refresh();
      await selectedResource.refresh();
    } catch (error) {
      setError(error instanceof ApiError ? error.message : "No fue posible guardar.");
    }
  }

  if (resource.status === "loading") {
    return <LoadingState label="Cargando facilities..." />;
  }

  if (resource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar facilities"
        description={resource.error.message}
        onRetry={() => void resource.refresh()}
      />
    );
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Facilities</h1>
          <p>Listado operativo de sucursales y centros.</p>
        </div>
      </section>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        <div className="filters-row">
          <FormField label="Tipo">
            <Select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">Todos</option>
              <option value="BRANCH">BRANCH</option>
              <option value="AGENCY">AGENCY</option>
              <option value="OFFICE">OFFICE</option>
              <option value="DISTRIBUTION_CENTER">DISTRIBUTION_CENTER</option>
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
        <Table
          columns={["Código", "Nombre", "Tipo", "Estado", "Acción"]}
          rows={resource.data.items.map((facility) => [
            facility.code,
            facility.name,
            facility.type,
            facility.isActive ? "Activa" : "Inactiva",
            <Button
              key={facility.id}
              variant="secondary"
              onClick={() => setSelectedFacilityId(facility.id)}
            >
              Editar
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
          <h2>Nueva facility</h2>
          <FacilityForm onSubmit={(event) => void submitFacility(event)} />
        </Card>
        <Card>
          <h2>Detalle</h2>
          {selectedFacilityId && selectedResource.status === "success" && selectedResource.data ? (
            <FacilityForm
              facility={selectedResource.data}
              onSubmit={(event) => void submitFacility(event, selectedResource.data?.id)}
            />
          ) : (
            <p>Selecciona una facility para editarla.</p>
          )}
        </Card>
      </section>
    </div>
  );
}

function FacilityForm({
  facility,
  onSubmit,
}: {
  facility?: import("@/lib/api/contracts").Facility | null;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <FormField label="Código">
        <Input name="code" defaultValue={facility?.code || ""} required />
      </FormField>
      <FormField label="Nombre">
        <Input name="name" defaultValue={facility?.name || ""} required />
      </FormField>
      <FormField label="Tipo">
        <Select name="type" defaultValue={facility?.type || "BRANCH"}>
          <option value="BRANCH">BRANCH</option>
          <option value="AGENCY">AGENCY</option>
          <option value="OFFICE">OFFICE</option>
          <option value="DISTRIBUTION_CENTER">DISTRIBUTION_CENTER</option>
          <option value="INTERNATIONAL_WAREHOUSE">INTERNATIONAL_WAREHOUSE</option>
        </Select>
      </FormField>
      <FormField label="Propiedad">
        <Select name="ownershipType" defaultValue={facility?.ownershipType || "OWNED"}>
          <option value="OWNED">OWNED</option>
          <option value="AGENCY">AGENCY</option>
          <option value="PARTNER">PARTNER</option>
        </Select>
      </FormField>
      <FormField label="País">
        <Input name="countryCode" defaultValue={facility?.countryCode || "DO"} required />
      </FormField>
      <FormField label="Provincia">
        <Input name="province" defaultValue={facility?.province || ""} />
      </FormField>
      <FormField label="Ciudad">
        <Input name="city" defaultValue={facility?.city || ""} />
      </FormField>
      <FormField label="Dirección 1">
        <Input name="addressLine1" defaultValue={facility?.addressLine1 || ""} />
      </FormField>
      <FormField label="Dirección 2">
        <Input name="addressLine2" defaultValue={facility?.addressLine2 || ""} />
      </FormField>
      <FormField label="Teléfono">
        <Input name="phone" defaultValue={facility?.phone || ""} />
      </FormField>
      <FormField label="Correo">
        <Input name="email" defaultValue={facility?.email || ""} />
      </FormField>
      <label className="toggle-row">
        <input
          type="checkbox"
          name="isCustomerFacing"
          defaultChecked={facility?.isCustomerFacing ?? true}
        />
        <span>Atiende clientes</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          name="isPackageOrigin"
          defaultChecked={facility?.isPackageOrigin ?? false}
        />
        <span>Origen de paquetes</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          name="isDistributionCenter"
          defaultChecked={facility?.isDistributionCenter ?? false}
        />
        <span>Centro de distribución</span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={facility?.isActive ?? true}
        />
        <span>Activa</span>
      </label>
      <Button type="submit">{facility ? "Guardar cambios" : "Crear facility"}</Button>
    </form>
  );
}
