"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { backofficeApi } from "@/lib/api/backoffice";
import { CreateDispatchDto } from "@/lib/api/contracts";
import { DispatchForm } from "@/components/dispatches/DispatchForm";

export default function NewDispatchPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: CreateDispatchDto) => {
    setIsLoading(true);
    setError(null);
    try {
      const created = await backofficeApi.createDispatch(data);
      router.push(`/dispatches/${created.id}`);
    } catch (e) {
      console.error(e);
      setError("Error al crear el despacho. Verifica los datos ingresados.");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Crear Nuevo Despacho</h1>
        <p className="text-gray-500 mt-1">Registra un nuevo despacho o vuelo consolidado.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <DispatchForm onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  );
}
