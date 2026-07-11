"use client";

import useSWR from "swr";
import { backofficeApi } from "@/lib/api/backoffice";
import type { PickupRequestRecord } from "@/lib/api/contracts";
import { Badge } from "@/components/ui/badge";

export default function PickupsPage() {
  const { data: pickups, error, isLoading } = useSWR<PickupRequestRecord[]>(
    "/pickup-requests",
    () => backofficeApi.listPickupRequests()
  );

  const getStatusBadge = (status: PickupRequestRecord["status"]) => {
    switch (status) {
      case "DRAFT":
        return <Badge tone="neutral">Borrador</Badge>;
      case "READY":
        return <Badge tone="neutral">Lista</Badge>;
      case "COMPLETED":
        return <Badge tone="success">Completada</Badge>;
      case "CANCELLED":
        return <Badge tone="danger">Cancelada</Badge>;
      default:
        return <Badge tone="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Recolecciones</h1>
          <p>Gestión de solicitudes de recolección.</p>
        </div>
      </div>

      <div className="ui-card">
        {isLoading ? (
          <div className="ui-state">Cargando recolecciones...</div>
        ) : error ? (
          <div className="ui-state ui-state--error">Error al cargar las recolecciones.</div>
        ) : !pickups || pickups.length === 0 ? (
          <div className="ui-state">
            No se encontraron recolecciones.
          </div>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Nº Recolección</th>
                  <th>Estado</th>
                  <th>Fecha Creación</th>
                </tr>
              </thead>
              <tbody>
                {pickups.map((pu) => (
                  <tr key={pu.id}>
                    <td>
                      <span className="inline-code">{pu.pickupNumber}</span>
                    </td>
                    <td>
                      {getStatusBadge(pu.status)}
                    </td>
                    <td>
                      {new Date(pu.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
