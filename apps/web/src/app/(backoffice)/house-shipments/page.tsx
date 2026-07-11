"use client";

import { useState } from "react";
import useSWR from "swr";

import { HouseShipmentStatusBadge } from "@/components/house-shipments/HouseShipmentStatusBadge";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { backofficeApi } from "@/lib/api/backoffice";
import type { HouseShipment, MasterShipment } from "@/lib/api/contracts";

function masterShipmentOptionLabel(masterShipment: MasterShipment) {
  const route = [masterShipment.origin, masterShipment.destination]
    .filter(Boolean)
    .join(" -> ");
  return route
    ? `${masterShipment.dispatchCode} - ${route}`
    : masterShipment.dispatchCode;
}

export default function HouseShipmentsPage() {
  const [selectedMasterShipmentId, setSelectedMasterShipmentId] = useState("");
  const {
    data: masterShipments,
    error: masterShipmentsError,
    isLoading: masterShipmentsLoading,
  } = useSWR<MasterShipment[]>("/master-shipments", () =>
    backofficeApi.listMasterShipments(),
  );

  const {
    data: houseShipments,
    error: houseShipmentsError,
    isLoading: houseShipmentsLoading,
  } = useSWR<HouseShipment[]>(
    selectedMasterShipmentId
      ? ["/master-shipments", selectedMasterShipmentId, "house-shipments"]
      : null,
    () => backofficeApi.listHouseShipments(selectedMasterShipmentId),
  );

  const selectedMasterShipment = masterShipments?.find(
    (masterShipment) => masterShipment.id === selectedMasterShipmentId,
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
        {masterShipmentsLoading ? (
          <div className="ui-state">Cargando Master Shipments...</div>
        ) : masterShipmentsError ? (
          <div className="ui-state ui-state--error">
            Error al cargar los Master Shipments.
          </div>
        ) : !masterShipments || masterShipments.length === 0 ? (
          <div className="ui-state">
            No hay Master Shipments disponibles para consultar envÃ­os.
          </div>
        ) : (
          <div className="form-grid">
            <FormField label="Master Shipment">
              <Select
                value={selectedMasterShipmentId}
                onChange={(event) =>
                  setSelectedMasterShipmentId(event.target.value)
                }
              >
                <option value="">Selecciona un Master Shipment</option>
                {masterShipments.map((masterShipment) => (
                  <option key={masterShipment.id} value={masterShipment.id}>
                    {masterShipmentOptionLabel(masterShipment)}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        )}
      </div>

      {selectedMasterShipmentId ? (
        <div className="ui-card">
          <div className="page-header">
            <div>
              <h2>HAWBs</h2>
              <p>
                {selectedMasterShipment
                  ? masterShipmentOptionLabel(selectedMasterShipment)
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
                      <td>
                        <HouseShipmentStatusBadge status={shipment.status} />
                      </td>
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
