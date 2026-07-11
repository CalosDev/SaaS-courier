"use client";

import useSWR from "swr";
import { backofficeApi } from "@/lib/api/backoffice";
import type { CustomsManifest } from "@/lib/api/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

function formatArrivalDate(arrivalDate: CustomsManifest["arrivalDate"]) {
  return arrivalDate ? new Date(arrivalDate).toLocaleDateString() : "Sin fecha";
}

export default function CustomsManifestsPage() {
  const { data: manifests, error, isLoading, mutate } = useSWR<CustomsManifest[]>(
    "/customs-manifests",
    () => backofficeApi.listCustomsManifests()
  );

  const [transmitting, setTransmitting] = useState<string | null>(null);

  const handleTransmit = async (id: string) => {
    try {
      setTransmitting(id);
      await backofficeApi.transmitCustomsManifest(id);
      await mutate();
    } catch (err) {
      console.error("Error transmitting manifest:", err);
      alert("Error al transmitir manifiesto a SIGA.");
    } finally {
      setTransmitting(null);
    }
  };

  const getStatusBadge = (status: CustomsManifest["status"]) => {
    switch (status) {
      case "DRAFT":
        return <Badge tone="neutral">Borrador</Badge>;
      case "SUBMITTED":
        return <Badge tone="warning">Enviado</Badge>;
      case "APPROVED":
        return <Badge tone="success">Aprobado</Badge>;
      case "REJECTED":
        return <Badge tone="danger">Rechazado</Badge>;
      default:
        return <Badge tone="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Manifiestos Aduaneros</h1>
          <p>Gestión de manifiestos y declaración de aduanas.</p>
        </div>
      </div>

      <div className="ui-card">
        {isLoading ? (
          <div className="ui-state">Cargando manifiestos...</div>
        ) : error ? (
          <div className="ui-state ui-state--error">Error al cargar los manifiestos.</div>
        ) : !manifests || manifests.length === 0 ? (
          <div className="ui-state">
            No se encontraron manifiestos aduaneros.
          </div>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Vuelo</th>
                  <th>Fecha Llegada</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {manifests.map((manifest) => (
                  <tr key={manifest.id}>
                    <td>
                      <span className="inline-code">{manifest.code}</span>
                    </td>
                    <td>
                      {manifest.flightNumber}
                    </td>
                    <td>
                      {formatArrivalDate(manifest.arrivalDate)}
                    </td>
                    <td>
                      {getStatusBadge(manifest.status)}
                    </td>
                    <td>
                      {manifest.status === "DRAFT" && (
                        <Button
                          variant="primary"
                          disabled={transmitting === manifest.id}
                          onClick={() => handleTransmit(manifest.id)}
                        >
                          {transmitting === manifest.id ? "Transmitiendo..." : "Transmitir a SIGA"}
                        </Button>
                      )}
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
