"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PermissionBoundary } from "@/components/auth/permission-boundary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { backofficeApi } from "@/lib/api/backoffice";

export default function NewCustomsCasePage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [caseNumber, setCaseNumber] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!caseNumber.trim()) {
      pushToast("El número de caso es requerido");
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await backofficeApi.createCustomsCase({
        caseNumber: caseNumber.trim(),
      });
      pushToast("Caso aduanero registrado correctamente");
      router.push(`/customs/cases/${data.id}`);
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "Ocurrió un error inesperado",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PermissionBoundary requiredPermissions={["customs.manage"]}>
      <div className="page-stack">
        <section className="page-header">
          <div>
            <h1>Registrar caso aduanero</h1>
            <p>Registra un nuevo caso manual o asistido.</p>
          </div>
        </section>

        <Card>
          <form className="ui-form" onSubmit={handleSubmit}>
            <div className="ui-form__fields">
              <FormField label="Número de caso *">
                <Input
                  value={caseNumber}
                  onChange={(event) => setCaseNumber(event.target.value)}
                  placeholder="Ej. CASO-2026-0001"
                  disabled={isSubmitting}
                />
              </FormField>
            </div>

            <div className="ui-form__actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                Registrar
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </PermissionBoundary>
  );
}
