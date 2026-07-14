"use client";

import useSWR from "swr";
import { use, useState } from "react";
import { backofficeApi } from "@/lib/api/backoffice";
import type {
  FacilityTransfer,
  WarehouseLocationListResponse,
} from "@/lib/api/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";

export default function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: transfer, error, isLoading, mutate } = useSWR<FacilityTransfer>(
    `/transfers/${id}`,
    () => backofficeApi.getTransfer(id)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // States for adding package
  const [newPackageId, setNewPackageId] = useState("");
  const [destinationLocationId, setDestinationLocationId] = useState("");

  const { data: destinationLocationsData } = useSWR<WarehouseLocationListResponse>(
    transfer?.status === "IN_TRANSIT"
      ? `/inventory/locations?facilityId=${transfer.destinationFacilityId}&isActive=true`
      : null,
    () =>
      backofficeApi.listInventoryLocations({
        facilityId: transfer!.destinationFacilityId,
        isActive: true,
        pageSize: 100,
      }),
  );

  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPackageId.trim()) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await backofficeApi.addTransferItems(id, { packageId: newPackageId.trim() });
      setNewPackageId("");
      await mutate();
    } catch (err: any) {
      setSubmitError(err.message || "Error al agregar paquete");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!confirm("¿Seguro que deseas remover este paquete del traslado?")) return;
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await backofficeApi.removeTransferItem(id, itemId);
      await mutate();
    } catch (err: any) {
      setSubmitError(err.message || "Error al remover paquete");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDispatch = async () => {
    if (!confirm("¿Confirmar despacho de traslado?")) return;
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await backofficeApi.dispatchTransfer(id);
      await mutate();
    } catch (err: any) {
      setSubmitError(err.message || "Error al despachar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("¿Cancelar esta transferencia en borrador?")) return;
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await backofficeApi.cancelTransfer(id);
      await mutate();
    } catch (err: any) {
      setSubmitError(err.message || "Error al cancelar la transferencia");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiveItem = async (itemId: string, status: "RECEIVED" | "MISSING" | "DAMAGED") => {
    if (status !== "MISSING" && !destinationLocationId) {
      setSubmitError("Selecciona una ubicación activa en la instalación destino.");
      return;
    }
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await backofficeApi.receiveTransferItem(id, itemId, {
        status,
        destinationLocationId:
          status === "MISSING" ? undefined : destinationLocationId,
      });
      await mutate();
    } catch (err: any) {
      setSubmitError(err.message || "Error al procesar recepción del paquete");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="page-stack">Cargando detalles...</div>;
  if (error || !transfer) return <div className="page-stack"><Alert tone="error">Error al cargar transferencia</Alert></div>;

  const isDraft = transfer.status === "DRAFT";
  const isInTransit = transfer.status === "IN_TRANSIT";
  const destinationLocations = destinationLocationsData?.items ?? [];

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Traslado: {transfer.transferNumber}</h1>
          <p>Origen: {transfer.originFacilityId} &rarr; Destino: {transfer.destinationFacilityId}</p>
        </div>
        <div>
          <Badge tone={
            transfer.status === "COMPLETED" ? "success" :
            transfer.status === "IN_TRANSIT" ? "warning" :
            transfer.status === "CANCELLED" ? "danger" : "neutral"
          }>
            {transfer.status}
          </Badge>
        </div>
      </div>

      {submitError && <Alert tone="error">{submitError}</Alert>}

      <section className="content-grid">
        <Card>
          <h2>Detalles del Traslado</h2>
          <div style={{ marginTop: "1rem" }}>
            <p><strong>ID:</strong> {transfer.id}</p>
            <p><strong>Fecha Creación:</strong> {new Date(transfer.createdAt).toLocaleString()}</p>
            <p><strong>Notas:</strong> {transfer.notes || "N/A"}</p>
            {transfer.dispatchedAt && <p><strong>Despachado en:</strong> {new Date(transfer.dispatchedAt).toLocaleString()}</p>}
            {transfer.receivedAt && <p><strong>Recibido en:</strong> {new Date(transfer.receivedAt).toLocaleString()}</p>}
          </div>

          <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem" }}>
            {isDraft && (
              <>
                <Button onClick={handleDispatch} disabled={isSubmitting || (transfer.items?.length || 0) === 0}>
                  Despachar
                </Button>
                <Button variant="danger" onClick={handleCancel} disabled={isSubmitting}>
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </Card>

        <Card>
          <h2>Paquetes ({transfer.items?.length || 0})</h2>

          {isInTransit ? (
            <FormField label="Ubicación de recepción en destino">
              <Select
                value={destinationLocationId}
                onChange={(event) => setDestinationLocationId(event.target.value)}
              >
                <option value="">Selecciona una ubicación</option>
                {destinationLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code} - {location.name}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}

          {isDraft && (
            <form onSubmit={handleAddPackage} style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", marginBottom: "1rem" }}>
              <Input
                value={newPackageId}
                onChange={e => setNewPackageId(e.target.value)}
                placeholder="ID de paquete"
                required
              />
              <Button type="submit" disabled={isSubmitting}>Agregar</Button>
            </form>
          )}

          {transfer.items && transfer.items.length > 0 ? (
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Package ID</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {transfer.items.map((item) => (
                    <tr key={item.id}>
                      <td><span className="inline-code">{item.packageId}</span></td>
                      <td>
                        <Badge tone={
                          item.status === "RECEIVED" ? "success" :
                          item.status === "PENDING" ? "neutral" : "danger"
                        }>
                          {item.status}
                        </Badge>
                      </td>
                      <td>
                        {isDraft && (
                          <Button variant="danger" onClick={() => handleRemoveItem(item.id)} disabled={isSubmitting}>
                            Remover
                          </Button>
                        )}
                        {isInTransit && item.status === "PENDING" && (
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <Button variant="secondary" onClick={() => handleReceiveItem(item.id, "RECEIVED")} disabled={isSubmitting}>Recibir</Button>
                            <Button variant="secondary" onClick={() => handleReceiveItem(item.id, "DAMAGED")} disabled={isSubmitting}>Dañado</Button>
                            <Button variant="danger" onClick={() => handleReceiveItem(item.id, "MISSING")} disabled={isSubmitting}>Faltante</Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No hay paquetes en este traslado.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
