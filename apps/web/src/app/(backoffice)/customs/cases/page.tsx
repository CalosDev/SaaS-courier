"use client";

import useSWR from "swr";
import { backofficeApi } from "@/lib/api/backoffice";
import type { CustomsCase } from "@/lib/api/contracts";
import { Badge } from "@/components/ui/badge";

export default function CustomsCasesPage() {
  const { data, error, isLoading } = useSWR(
    "/customs-cases",
    () => backofficeApi.listCustomsCases()
  );
  const cases = data?.items || [];

  const getStatusBadge = (status: CustomsCase["status"]) => {
    switch (status) {
      case "PENDING_REVIEW":
        return <Badge tone="warning">Pendiente</Badge>;
      case "UNDER_REVIEW":
        return <Badge tone="neutral">En Revisión</Badge>;
      case "RELEASED":
        return <Badge tone="success">Liberado</Badge>;
      case "HELD":
        return <Badge tone="danger">Retenido</Badge>;
      case "REJECTED":
        return <Badge tone="danger">Rechazado</Badge>;
      case "CANCELLED":
        return <Badge tone="neutral">Cancelado</Badge>;
      default:
        return <Badge tone="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Casos Aduaneros</h1>
          <p>Gestión de retenciones e incidentes con la DGA.</p>
        </div>
      </div>

      <div className="ui-card">
        {isLoading ? (
          <div className="ui-state">Cargando casos...</div>
        ) : error ? (
          <div className="ui-state ui-state--error">Error al cargar los casos aduaneros.</div>
        ) : cases.length === 0 ? (
          <div className="ui-state">
            No se encontraron casos aduaneros.
          </div>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Nº Caso</th>
                  <th>Estado</th>
                  <th>Fecha Creación</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="inline-code">{c.caseNumber}</span>
                    </td>
                    <td>
                      {getStatusBadge(c.status)}
                    </td>
                    <td>
                      {new Date(c.createdAt).toLocaleDateString()}
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
