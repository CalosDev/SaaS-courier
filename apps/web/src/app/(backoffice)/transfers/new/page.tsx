"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { backofficeApi } from "@/lib/api/backoffice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/api-error";
import useSWR from "swr";
import { Select } from "@/components/ui/select";
import type { FacilityListResponse } from "@/lib/api/contracts";

export default function NewTransferPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // We need to fetch facilities to populate the dropdowns
  const { data: facilitiesData, isLoading } = useSWR<FacilityListResponse>(
    "/facilities?isActive=true",
    () => backofficeApi.listFacilities({ isActive: true })
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const originFacilityId = String(formData.get("originFacilityId"));
    const destinationFacilityId = String(formData.get("destinationFacilityId"));
    const notes = String(formData.get("notes") || "");

    if (originFacilityId === destinationFacilityId) {
      setError("El origen y destino no pueden ser el mismo.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const newTransfer = await backofficeApi.createTransfer({
        originFacilityId,
        destinationFacilityId,
        notes: notes || undefined,
      });

      router.push(`/transfers/${newTransfer.id}`);
    } catch (error) {
      setError(error instanceof ApiError ? error.message : "Error al crear transferencia.");
      setIsSubmitting(false);
    }
  };

  const facilities = facilitiesData?.items || [];

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Nueva Transferencia</h1>
          <p>Crea un nuevo documento de traslado entre instalaciones.</p>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <Card>
        {isLoading ? (
          <p>Cargando facilities...</p>
        ) : (
          <form className="form-grid" onSubmit={handleSubmit}>
            <FormField label="Instalación de Origen">
              <Select name="originFacilityId" required>
                <option value="">Seleccione origen</option>
                {facilities.map(f => (
                  <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Instalación de Destino">
              <Select name="destinationFacilityId" required>
                <option value="">Seleccione destino</option>
                {facilities.map(f => (
                  <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Notas (opcional)">
              <Input name="notes" placeholder="Motivo del traslado..." />
            </FormField>

            <div style={{ gridColumn: "1 / -1", marginTop: "1rem" }}>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creando..." : "Crear Transferencia"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
