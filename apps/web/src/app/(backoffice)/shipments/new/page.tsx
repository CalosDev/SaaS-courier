"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { backofficeApi } from "@/lib/api/backoffice";
import type { CreateMasterShipmentDto } from "@/lib/api/contracts";
import { DispatchForm } from "@/components/dispatches/DispatchForm";

export default function NewShipmentPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: CreateMasterShipmentDto) => {
    setIsLoading(true);
    setError(null);
    try {
      const created = await backofficeApi.createMasterShipment(data);
      router.push(`/shipments/${created.id}`);
    } catch (e) {
      console.error(e);
      setError("Error al crear el embarque. Verifica los datos ingresados.");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Crear Nuevo Embarque
        </h1>
        <p className="text-gray-500 mt-1">
          Registra un nuevo embarque maestro internacional.
        </p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      ) : null}

      <DispatchForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        submitLabel="Crear Embarque"
      />
    </div>
  );
}
