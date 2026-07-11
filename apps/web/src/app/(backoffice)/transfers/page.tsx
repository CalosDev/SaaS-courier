"use client";

import useSWR from "swr";
import { backofficeApi } from "@/lib/api/backoffice";
import type { FacilityTransfer } from "@/lib/api/contracts";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TransfersPage() {
  const { data, error, isLoading } = useSWR<{ items: FacilityTransfer[], pagination: any }>(
    "/transfers",
    () => backofficeApi.listTransfers()
  );

  const getStatusBadge = (status: FacilityTransfer["status"]) => {
    switch (status) {
      case "DRAFT":
        return <Badge tone="neutral">Borrador</Badge>;
      case "IN_TRANSIT":
        return <Badge tone="warning">En Tránsito</Badge>;
      case "COMPLETED":
        return <Badge tone="success">Completado</Badge>;
      case "CANCELLED":
        return <Badge tone="danger">Cancelado</Badge>;
      default:
        return <Badge tone="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Transferencias Internas</h1>
          <p>Gestión de movimientos de paquetes entre sucursales y almacenes.</p>
        </div>
        <div>
          <Link href="/transfers/new">
            <Button>Nueva Transferencia</Button>
          </Link>
        </div>
      </div>

      <div className="ui-card">
        {isLoading ? (
          <div className="ui-state">Cargando transferencias...</div>
        ) : error ? (
          <div className="ui-state ui-state--error">Error al cargar las transferencias.</div>
        ) : !data || data.items.length === 0 ? (
          <div className="ui-state">
            No se encontraron transferencias.
          </div>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Nº Transferencia</th>
                  <th>Origen</th>
                  <th>Destino</th>
                  <th>Estado</th>
                  <th>Fecha Creación</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((transfer) => (
                  <tr key={transfer.id}>
                    <td>
                      <span className="inline-code">{transfer.transferNumber}</span>
                    </td>
                    <td>{transfer.originFacilityId}</td>
                    <td>{transfer.destinationFacilityId}</td>
                    <td>
                      {getStatusBadge(transfer.status)}
                    </td>
                    <td>
                      {new Date(transfer.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <Link href={`/transfers/${transfer.id}`}>
                        <Button variant="secondary">Ver Detalles</Button>
                      </Link>
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
