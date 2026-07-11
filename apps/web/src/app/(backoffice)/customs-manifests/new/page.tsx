"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import type { CreateCustomsManifestDto } from "@/lib/api/contracts";

export default function NewCustomsManifestPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<CreateCustomsManifestDto>({
    flightNumber: "",
    arrivalDate: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const created = await backofficeApi.createCustomsManifest({
        flightNumber: formData.flightNumber.trim(),
        arrivalDate: formData.arrivalDate || undefined,
      });
      router.push(`/customs-manifests/${created.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Error al crear el manifiesto aduanero.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Crear manifiesto aduanero
        </h1>
        <p className="text-gray-500 mt-1">
          Registra el manifiesto para declaracion y transmision aduanal.
        </p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      ) : null}

      <Card className="p-5">
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <FormField label="Vuelo">
            <Input
              value={formData.flightNumber}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  flightNumber: event.target.value,
                }))
              }
              required
              placeholder="Ej. AA123"
            />
          </FormField>
          <FormField label="Fecha llegada">
            <Input
              type="date"
              value={formData.arrivalDate || ""}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  arrivalDate: event.target.value,
                }))
              }
            />
          </FormField>
          <Button
            type="submit"
            disabled={isSubmitting || !formData.flightNumber.trim()}
          >
            {isSubmitting ? "Creando..." : "Crear manifiesto"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
