"use client";

import { useState } from "react";
import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { backofficeApi } from "@/lib/api/backoffice";
import type {
  Dispatch,
  HouseShipment,
  HouseShipmentStatus,
} from "@/lib/api/contracts";

function houseShipmentStatusBadge(status: HouseShipmentStatus) {
  switch (status) {
    case "DRAFT":
      return <Badge tone="neutral">Borrador</Badge>;
    case "CLOSED":
      return <Badge tone="success">Cerrado</Badge>;
    case "CANCELLED":
      return <Badge tone="danger">Cancelado</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}

function dispatchOptionLabel(dispatch: Dispatch) {
  const route = [dispatch.origin, dispatch.destination].filter(Boolean).join(" -> ");
  return route ? `${dispatch.dispatchCode} - ${route}` : dispatch.dispatchCode;
}

export default function HouseShipmentsPage() {
  const [selectedDispatchId, setSelectedDispatchId] = useState("");
  const {
    data: dispatches,
    error: dispatchesError,
    isLoading: dispatchesLoading,
  } = useSWR<Dispatch[]>("/dispatches", () => backofficeApi.listDispatches());

  const {
    data: houseShipments,
    error: houseShipmentsError,
    isLoading: houseShipmentsLoading,
  } = useSWR<HouseShipment[]>(
    selectedDispatchId
      ? ["/master-shipments", selectedDispatchId, "house-shipments"]
      : null,
    () => backofficeApi.listHouseShipments(selectedDispatchId),
  );

  const selectedDispatch = dispatches?.find(
    (dispatch) => dispatch.id === selectedDispatchId,
  );

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>EnvÃ­os (House Shipments)</h1>
          <p>GestiÃ³n de envÃ­os y HAWBs.</p>
        </div>
      </div>

      <div className="ui-card">
        {dispatchesLoading ? (
          <div className="ui-state">Cargando Master Shipments...</div>
        ) : dispatchesError ? (
          <div className="ui-state ui-state--error">
            Error al cargar los Master Shipments.
          </div>
        ) : !dispatches || dispatches.length === 0 ? (
          <div className="ui-state">
            No hay Master Shipments disponibles para consultar envÃ­os.
          </div>
        ) : (
          <div className="form-grid">
            <FormField label="Master Shipment">
              <Select
                value={selectedDispatchId}
                onChange={(event) => setSelectedDispatchId(event.target.value)}
              >
                <option value="">Selecciona un Master Shipment</option>
                {dispatches.map((dispatch) => (
                  <option key={dispatch.id} value={dispatch.id}>
                    {dispatchOptionLabel(dispatch)}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        )}
      </div>

      {selectedDispatchId ? (
        <div className="ui-card">
          <div className="page-header">
            <div>
              <h2>HAWBs</h2>
              <p>
                {selectedDispatch
                  ? dispatchOptionLabel(selectedDispatch)
                  : "Master Shipment seleccionado"}
              </p>
            </div>
          </div>

          {houseShipmentsLoading ? (
            <div className="ui-state">Cargando envÃ­os...</div>
          ) : houseShipmentsError ? (
            <div className="ui-state ui-state--error">
              Error al cargar los envÃ­os.
            </div>
          ) : !houseShipments || houseShipments.length === 0 ? (
            <div className="ui-state">
              No se encontraron envÃ­os para este Master Shipment.
            </div>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>HAWB</th>
                    <th>Estado</th>
                    <th>Paquetes</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {houseShipments.map((shipment) => (
                    <tr key={shipment.id}>
                      <td>
                        <span className="inline-code">{shipment.hawb}</span>
                      </td>
                      <td>{houseShipmentStatusBadge(shipment.status)}</td>
                      <td>{shipment.packages?.length ?? 0}</td>
                      <td>{shipment.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
