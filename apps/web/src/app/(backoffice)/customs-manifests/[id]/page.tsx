"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import useSWR from "swr";

import { CustomsManifestStatusBadge } from "@/components/customs-manifests/CustomsManifestStatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";

export default function CustomsManifestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { pushToast } = useToast();
  const [flightNumber, setFlightNumber] = useState<string | null>(null);
  const [arrivalDate, setArrivalDate] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    data: manifest,
    error,
    isLoading,
    mutate,
  } = useSWR(`/customs-manifests/${id}`, () =>
    backofficeApi.getCustomsManifest(id),
  );

  async function updateManifest() {
    if (!manifest) return;
    setIsSubmitting(true);
    try {
      const updated = await backofficeApi.updateCustomsManifest(id, {
        flightNumber: flightNumber ?? manifest.flightNumber,
        arrivalDate:
          arrivalDate ?? manifest.arrivalDate?.slice(0, 10) ?? undefined,
      });
      await mutate(updated, { revalidate: false });
      pushToast("Manifiesto actualizado.");
    } catch (caught) {
      pushToast(
        caught instanceof ApiError
          ? caught.message
          : "Error al actualizar el manifiesto.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function runAction(
    action: "build" | "validate" | "finalize" | "cancel",
  ) {
    setIsSubmitting(true);
    try {
      if (action === "build")
        await backofficeApi.buildCustomsManifestVersion(id);
      if (action === "validate")
        await backofficeApi.validateCustomsManifest(id);
      if (action === "finalize")
        await backofficeApi.finalizeCustomsManifest(id);
      if (action === "cancel") await backofficeApi.cancelCustomsManifest(id);
      await mutate();
      pushToast("Manifiesto actualizado.");
    } catch (caught) {
      pushToast(
        caught instanceof ApiError
          ? caught.message
          : "Error al actualizar el manifiesto.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <div className="ui-state">Cargando manifiesto...</div>;
  if (error || !manifest)
    return <div className="ui-state">Error al cargar el manifiesto.</div>;

  const isDraft = manifest.status === "DRAFT";
  const isFrozen =
    manifest.status === "FINALIZED" || manifest.status === "CANCELLED";
  const flightNumberValue = flightNumber ?? manifest.flightNumber ?? "";
  const arrivalDateValue =
    arrivalDate ?? manifest.arrivalDate?.slice(0, 10) ?? "";

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/customs-manifests" aria-label="Volver">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1>Manifiesto {manifest.code}</h1>
            <CustomsManifestStatusBadge status={manifest.status} />
          </div>
          <p>Snapshots internos versionados, sin transmisión externa.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isFrozen ? (
            <Button
              onClick={() => void runAction("build")}
              disabled={isSubmitting}
            >
              Construir versión
            </Button>
          ) : null}
          {manifest.currentVersion > 0 && !isFrozen ? (
            <Button
              variant="secondary"
              onClick={() => void runAction("validate")}
              disabled={isSubmitting}
            >
              Validar
            </Button>
          ) : null}
          {manifest.status === "VALIDATED" ? (
            <Button
              onClick={() => void runAction("finalize")}
              disabled={isSubmitting}
            >
              Finalizar
            </Button>
          ) : null}
          {!isFrozen ? (
            <Button
              variant="danger"
              onClick={() => void runAction("cancel")}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
          ) : null}
        </div>
      </div>

      <div className="content-grid">
        <Card>
          <h2>Datos</h2>
          <div className="form-grid">
            <FormField label="Vuelo">
              <Input
                value={flightNumberValue}
                onChange={(event) => setFlightNumber(event.target.value)}
                disabled={!isDraft}
              />
            </FormField>
            <FormField label="Fecha llegada">
              <Input
                type="date"
                value={arrivalDateValue}
                onChange={(event) => setArrivalDate(event.target.value)}
                disabled={!isDraft}
              />
            </FormField>
            <Button
              onClick={() => void updateManifest()}
              disabled={isSubmitting || !isDraft || !flightNumberValue}
            >
              Guardar cambios
            </Button>
          </div>
        </Card>

        <Card>
          <h2>Versiones inmutables</h2>
          {!manifest.versions?.length ? (
            <div className="ui-state">No hay versiones construidas.</div>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Versión</th>
                    <th>Validación</th>
                    <th>Items</th>
                  </tr>
                </thead>
                <tbody>
                  {manifest.versions.map((version) => (
                    <tr key={version.id}>
                      <td>v{version.versionNumber}</td>
                      <td>{version.validationStatus}</td>
                      <td>{version.items.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
