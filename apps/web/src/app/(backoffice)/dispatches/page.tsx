"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { backofficeApi } from "@/lib/api/backoffice";
import { Dispatch } from "@/lib/api/contracts";
import { DispatchList } from "@/components/dispatches/DispatchList";
import { Button } from "@/components/ui/button";

export default function DispatchesPage() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await backofficeApi.listDispatches();
        setDispatches(data);
      } catch (e) {
        setError("Error al cargar los despachos");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Despachos</h1>
        <Link href="/dispatches/new">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            Crear Despacho
          </Button>
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">Cargando...</div>
      ) : (
        <DispatchList dispatches={dispatches} />
      )}
    </div>
  );
}
