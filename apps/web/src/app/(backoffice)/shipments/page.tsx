"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { backofficeApi } from "@/lib/api/backoffice";
import type { MasterShipment } from "@/lib/api/contracts";
import { DispatchList } from "@/components/dispatches/DispatchList";
import { Button } from "@/components/ui/button";

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<MasterShipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await backofficeApi.listMasterShipments();
        setShipments(data);
      } catch (e) {
        setError("Error al cargar los embarques");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Embarques</h1>
        <Link href="/shipments/new">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            Crear Embarque
          </Button>
        </Link>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="text-center py-12">Cargando...</div>
      ) : (
        <DispatchList
          dispatches={shipments}
          detailBasePath="/shipments"
          createHref="/shipments/new"
          emptyMessage="No hay embarques registrados"
          emptyActionLabel="Crear el primer embarque"
        />
      )}
    </div>
  );
}
