"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { CreateDispatchDto } from "@/lib/api/contracts";

interface DispatchFormProps {
  onSubmit: (data: CreateDispatchDto) => Promise<void>;
  isLoading?: boolean;
}

export function DispatchForm({ onSubmit, isLoading }: DispatchFormProps) {
  const [formData, setFormData] = useState<CreateDispatchDto>({
    origin: "",
    destination: "",
    departureTime: "",
    estimatedArrivalTime: "",
    carrier: "",
    flightNumber: "",
    mawb: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value || undefined,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="Origen">
          <Input
            name="origin"
            value={formData.origin || ""}
            onChange={handleChange}
            placeholder="Ej. MIA"
          />
        </FormField>

        <FormField label="Destino">
          <Input
            name="destination"
            value={formData.destination || ""}
            onChange={handleChange}
            placeholder="Ej. SDQ"
          />
        </FormField>

        <FormField label="Transportista (Aerolínea/Naviera)">
          <Input
            name="carrier"
            value={formData.carrier || ""}
            onChange={handleChange}
            placeholder="Ej. American Airlines"
          />
        </FormField>

        <FormField label="Número de Vuelo / Viaje">
          <Input
            name="flightNumber"
            value={formData.flightNumber || ""}
            onChange={handleChange}
            placeholder="Ej. AA1234"
          />
        </FormField>

        <FormField label="Fecha y Hora de Salida (Estimada)">
          <Input
            type="datetime-local"
            name="departureTime"
            value={formData.departureTime || ""}
            onChange={handleChange}
          />
        </FormField>

        <FormField label="Fecha y Hora de Llegada (Estimada)">
          <Input
            type="datetime-local"
            name="estimatedArrivalTime"
            value={formData.estimatedArrivalTime || ""}
            onChange={handleChange}
          />
        </FormField>

        <div className="md:col-span-2">
          <FormField label="Master Airway Bill (MAWB) / B/L">
            <Input
              name="mawb"
              value={formData.mawb || ""}
              onChange={handleChange}
              placeholder="Ej. 123-45678901"
            />
          </FormField>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
          {isLoading ? "Guardando..." : "Crear Despacho"}
        </Button>
      </div>
    </form>
  );
}
