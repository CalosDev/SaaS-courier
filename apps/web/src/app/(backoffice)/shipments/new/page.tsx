"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import type { FacilityListResponse } from "@/lib/api/contracts";

export default function NewShipmentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useSWR<FacilityListResponse>(
    "/facilities?isActive=true",
    () => backofficeApi.listFacilities({ isActive: true, pageSize: 100 }),
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const originFacilityId = String(form.get("originFacilityId") ?? "");
    const destinationFacilityId = String(
      form.get("destinationFacilityId") ?? "",
    );
    if (originFacilityId === destinationFacilityId) {
      setError("El origen y el destino deben ser facilities diferentes.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const shipment = await backofficeApi.createMasterShipment({
        originFacilityId,
        destinationFacilityId,
        transportMode: String(form.get("transportMode")) as
          | "AIR"
          | "SEA"
          | "GROUND",
        carrier: String(form.get("carrier") ?? "").trim() || undefined,
        flightNumber:
          String(form.get("flightNumber") ?? "").trim() || undefined,
        departureTime: String(form.get("departureTime") ?? "") || undefined,
        estimatedArrivalTime:
          String(form.get("estimatedArrivalTime") ?? "") || undefined,
        mawb: String(form.get("mawb") ?? "").trim() || undefined,
      });
      router.push(`/shipments/${shipment.id}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No fue posible crear el embarque.",
      );
      setIsSubmitting(false);
    }
  }

  const facilities = data?.items ?? [];

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Crear embarque maestro</h1>
          <p>Registra la ruta internacional y su modo de transporte.</p>
        </div>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Card>
        {isLoading ? (
          <p>Cargando facilities...</p>
        ) : (
          <form className="form-grid" onSubmit={handleSubmit}>
            <FormField label="Facility de origen">
              <Select name="originFacilityId" required>
                <option value="">Selecciona origen</option>
                {facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name} ({facility.code})
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Facility de destino">
              <Select name="destinationFacilityId" required>
                <option value="">Selecciona destino</option>
                {facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name} ({facility.code})
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Modo de transporte">
              <Select name="transportMode" defaultValue="AIR">
                <option value="AIR">Aéreo</option>
                <option value="SEA">Marítimo</option>
                <option value="GROUND">Terrestre</option>
              </Select>
            </FormField>
            <FormField label="Transportista">
              <Input name="carrier" maxLength={120} />
            </FormField>
            <FormField label="Vuelo o viaje">
              <Input name="flightNumber" maxLength={40} />
            </FormField>
            <FormField label="Salida estimada">
              <Input type="datetime-local" name="departureTime" />
            </FormField>
            <FormField label="Llegada estimada">
              <Input type="datetime-local" name="estimatedArrivalTime" />
            </FormField>
            <FormField label="MAWB o B/L">
              <Input name="mawb" maxLength={120} />
            </FormField>
            <div style={{ gridColumn: "1 / -1" }}>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creando..." : "Crear embarque"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
