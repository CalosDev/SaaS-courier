"use client";

import Link from "next/link";
import useSWR from "swr";
import { CustomsCaseStatusBadge } from "@/components/customs-cases/CustomsCaseStatusBadge";
import { Button } from "@/components/ui/button";
import { backofficeApi } from "@/lib/api/backoffice";
import type { CustomsCase, CustomsCaseListResponse } from "@/lib/api/contracts";

function formatCreatedAt(createdAt: CustomsCase["createdAt"]) {
  return new Date(createdAt).toLocaleDateString();
}

export default function CustomsCasesPage() {
  const { data, error, isLoading } = useSWR<CustomsCaseListResponse>(
    "/customs-cases",
    () => backofficeApi.listCustomsCases(),
  );
  const cases = data?.items || [];

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Casos Aduaneros</h1>
          <p>Gestión de retenciones e incidentes con la DGA.</p>
        </div>
        <Link href="/customs/cases/new">
          <Button>Registrar caso</Button>
        </Link>
      </div>

      <div className="ui-card">
        {isLoading ? (
          <div className="ui-state">Cargando casos...</div>
        ) : error ? (
          <div className="ui-state ui-state--error">
            Error al cargar los casos aduaneros.
          </div>
        ) : cases.length === 0 ? (
          <div className="ui-state">No se encontraron casos aduaneros.</div>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Nº Caso</th>
                  <th>Estado</th>
                  <th>Fecha Creación</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((customsCase) => (
                  <tr key={customsCase.id}>
                    <td>
                      <span className="inline-code">
                        {customsCase.caseNumber}
                      </span>
                    </td>
                    <td>
                      <CustomsCaseStatusBadge status={customsCase.status} />
                    </td>
                    <td>{formatCreatedAt(customsCase.createdAt)}</td>
                    <td>
                      <Link
                        href={`/customs/cases/${customsCase.id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Ver detalle
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
