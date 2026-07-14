"use client";

import Link from "next/link";
import useSWR from "swr";
import { CustomsManifestStatusBadge } from "@/components/customs-manifests/CustomsManifestStatusBadge";
import { Button } from "@/components/ui/button";
import { backofficeApi } from "@/lib/api/backoffice";
import type { CustomsManifest } from "@/lib/api/contracts";

function formatArrivalDate(arrivalDate: CustomsManifest["arrivalDate"]) {
  return arrivalDate ? new Date(arrivalDate).toLocaleDateString() : "Sin fecha";
}

export default function CustomsManifestsPage() {
  const { data: manifests, error, isLoading } = useSWR<CustomsManifest[]>(
    "/customs-manifests",
    () => backofficeApi.listCustomsManifests(),
  );

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Manifiestos Aduaneros</h1>
          <p>Gestión de manifiestos y declaración de aduanas.</p>
        </div>
        <Link href="/customs-manifests/new">
          <Button>Crear manifiesto</Button>
        </Link>
      </div>

      <div className="ui-card">
        {isLoading ? (
          <div className="ui-state">Cargando manifiestos...</div>
        ) : error ? (
          <div className="ui-state ui-state--error">
            Error al cargar los manifiestos.
          </div>
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
                    <td>{manifest.flightNumber}</td>
                    <td>{formatArrivalDate(manifest.arrivalDate)}</td>
                    <td>
                      <CustomsManifestStatusBadge status={manifest.status} />
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/customs-manifests/${manifest.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          Ver detalle
                        </Link>
                      </div>
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
