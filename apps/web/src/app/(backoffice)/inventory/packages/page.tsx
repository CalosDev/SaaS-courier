"use client";

import { useCallback, useMemo, useState } from "react";

import { PermissionBoundary } from "@/components/auth/permission-boundary";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { useAsyncState } from "@/hooks/use-async-state";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import {
  INVENTORY_MOVEMENT_TYPE_LABELS,
  WAREHOUSE_LOCATION_TYPE_LABELS,
  inventoryPositionLabel,
} from "@/lib/inventory";
import { PACKAGE_STATUS_LABELS, getPackageStatusTone } from "@/lib/packages";

export default function InventoryPackagesPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [movementType, setMovementType] = useState("PUTAWAY");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const packagesResource = useAsyncState(
    useCallback(
      () =>
        backofficeApi.listInventoryPackages({
          page,
          pageSize: 10,
          q: q || undefined,
          facilityId: facilityId || undefined,
          locationId: locationId || undefined,
        }),
      [facilityId, locationId, page, q],
    ),
  );

  const locationsResource = useAsyncState(
    useCallback(
      () =>
        backofficeApi.listInventoryLocations({
          page: 1,
          pageSize: 100,
          isActive: true,
          facilityId: facilityId || undefined,
        }),
      [facilityId],
    ),
  );

  const movementsResource = useAsyncState(
    useCallback(
      () =>
        selectedPackageId
          ? backofficeApi.listPackageInventoryMovements(selectedPackageId)
          : Promise.resolve({ items: [] }),
      [selectedPackageId],
    ),
  );

  const selectedPackage = useMemo(
    () =>
      packagesResource.status === "success"
        ? packagesResource.data.items.find((item) => item.id === selectedPackageId) ?? null
        : null,
    [packagesResource, selectedPackageId],
  );

  const availableLocations = useMemo(() => {
    if (locationsResource.status !== "success" || !selectedPackage) {
      return [];
    }

    return locationsResource.data.items.filter(
      (location) => location.facility.id === selectedPackage.reception.facility.id,
    );
  }, [locationsResource, selectedPackage]);

  async function submitMovement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!selectedPackage) {
      return;
    }

    setMessage(null);
    setError(null);
    const formData = new FormData(form);
    const selectedMovementType = String(formData.get("movementType") || "");
    const selectedLocationIdValue = String(formData.get("toLocationId") || "");
    const note = String(formData.get("note") || "") || null;

    const payload =
      selectedMovementType === "REMOVE"
        ? {
            movementType: selectedMovementType,
            note,
          }
        : {
            movementType: selectedMovementType,
            toLocationId: selectedLocationIdValue,
            note,
          };

    try {
      await backofficeApi.moveInventoryPackage(selectedPackage.id, payload);
      setMessage("Movimiento registrado.");
      await Promise.all([
        packagesResource.refresh(),
        locationsResource.refresh(),
        movementsResource.refresh(),
      ]);
      form.reset();
      setMovementType("PUTAWAY");
    } catch (error) {
      setError(
        error instanceof ApiError ? error.message : "No fue posible registrar el movimiento.",
      );
    }
  }

  if (packagesResource.status === "loading" || locationsResource.status === "loading") {
    return <LoadingState label="Cargando inventario..." />;
  }

  if (packagesResource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar el inventario"
        description={packagesResource.error.message}
        onRetry={() => void packagesResource.refresh()}
      />
    );
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

  return (
    <PermissionBoundary
      requiredPermissions={["inventory.read"]}
      fallback={
        <ErrorState
          title="Acceso no autorizado"
          description="Tu sesión no tiene permisos para consultar inventario."
        />
      }
    >
      <div className="page-stack">
        <section className="page-header">
          <div>
            <h1>Inventario de paquetes</h1>
            <p>
              Paquetes recibidos y su posición operativa actual dentro del facility
              de recepción.
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
                onChange={(event) => {
                  setFacilityId(event.target.value);
                  setLocationId("");
                }}
              >
                <option value="">Todos</option>
                {locationsResource.data.items
                  .map((location) => location.facility)
                  .filter(
                    (facility, index, array) =>
                      array.findIndex((entry) => entry.id === facility.id) === index,
                  )
                  .map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.code} · {facility.name}
                    </option>
                  ))}
              </Select>
            </FormField>
            <FormField label="Ubicación">
              <Select
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
              >
                <option value="">Todas</option>
                {locationsResource.data.items.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code} · {location.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </Card>

        <Card>
          {packagesResource.data.items.length === 0 ? (
            <EmptyState
              title="No hay paquetes en inventario"
              description="Los paquetes recibidos aparecerán aquí para su ubicación interna."
            />
          ) : (
            <Table
              columns={[
                "Tracking interno",
                "Cliente",
                "Facility",
                "Posición actual",
                "Estado",
                "Acción",
              ]}
              rows={packagesResource.data.items.map((item) => [
                item.internalTrackingNumber,
                item.customer.displayName,
                `${item.reception.facility.code} · ${item.reception.facility.name}`,
                inventoryPositionLabel(item.currentPosition),
                <Badge key={`${item.id}-status`} tone={getPackageStatusTone(item.status)}>
                  {PACKAGE_STATUS_LABELS[item.status]}
                </Badge>,
                <Button
                  key={item.id}
                  variant="secondary"
                  onClick={() => setSelectedPackageId(item.id)}
                >
                  Gestionar
                </Button>,
              ])}
            />
          )}

          <Pagination
            page={packagesResource.data.pagination.page}
            totalPages={packagesResource.data.pagination.totalPages}
            onPageChange={setPage}
          />
        </Card>

        <section className="content-grid">
          <PermissionBoundary requiredPermissions={["inventory.manage"]}>
            <Card>
              <h2>Movimiento</h2>
              {selectedPackage ? (
                <form className="form-grid" onSubmit={(event) => void submitMovement(event)}>
                  <Alert tone="info">
                    <strong>{selectedPackage.internalTrackingNumber}</strong>
                    <br />
                    Facility: {selectedPackage.reception.facility.code} ·{" "}
                    {selectedPackage.reception.facility.name}
                    <br />
                    Actual: {inventoryPositionLabel(selectedPackage.currentPosition)}
                  </Alert>
                  <FormField label="Tipo de movimiento">
                    <Select
                      name="movementType"
                      value={movementType}
                      onChange={(event) => setMovementType(event.target.value)}
                    >
                      {Object.entries(INVENTORY_MOVEMENT_TYPE_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </Select>
                  </FormField>
                  <FormField label="Ubicación destino">
                    <Select
                      name="toLocationId"
                      defaultValue=""
                      disabled={movementType === "REMOVE"}
                    >
                      <option value="">
                        {movementType === "REMOVE"
                          ? "No aplica"
                          : "Selecciona una ubicación"}
                      </option>
                      {availableLocations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.code} · {location.name} ·{" "}
                          {WAREHOUSE_LOCATION_TYPE_LABELS[location.type]}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Nota">
                    <Textarea name="note" rows={3} />
                  </FormField>
                  <Button type="submit">Registrar movimiento</Button>
                </form>
              ) : (
                <p>Selecciona un paquete para registrar movimientos.</p>
              )}
            </Card>
          </PermissionBoundary>

          <Card>
            <h2>Historial de movimientos</h2>
            {!selectedPackage ? (
              <p>Selecciona un paquete para consultar el historial.</p>
            ) : movementsResource.status === "loading" ? (
              <LoadingState label="Cargando movimientos..." />
            ) : movementsResource.status === "error" ? (
              <ErrorState
                title="No fue posible cargar movimientos"
                description={movementsResource.error.message}
                onRetry={() => void movementsResource.refresh()}
              />
            ) : movementsResource.data.items.length === 0 ? (
              <EmptyState
                title="Sin movimientos"
                description="Todavía no hay movimientos registrados para este paquete."
              />
            ) : (
              <Table
                columns={["Fecha", "Tipo", "Desde", "Hacia", "Empleado", "Nota"]}
                rows={movementsResource.data.items.map((item) => [
                  item.occurredAt.slice(0, 16).replace("T", " "),
                  INVENTORY_MOVEMENT_TYPE_LABELS[item.movementType],
                  item.fromLocation
                    ? `${item.fromLocation.code} · ${item.fromLocation.name}`
                    : "Sin ubicación",
                  item.toLocation
                    ? `${item.toLocation.code} · ${item.toLocation.name}`
                    : "Fuera de inventario",
                  item.movedBy.displayName,
                  item.note || "—",
                ])}
              />
            )}
          </Card>
        </section>
      </div>
    </PermissionBoundary>
  );
}
