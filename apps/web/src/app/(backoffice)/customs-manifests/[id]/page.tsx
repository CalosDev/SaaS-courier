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

function packageLabel(item: unknown) {
  if (!item || typeof item !== "object") {
    return "-";
  }

  const record = item as {
    id?: string;
    internalTrackingNumber?: string | null;
    externalTrackingNumber?: string | null;
  };

  return (
    record.internalTrackingNumber ||
    record.externalTrackingNumber ||
    record.id ||
    "-"
  );
}

function packageRowKey(item: unknown, index: number) {
  if (!item || typeof item !== "object") {
    return `package-row-${index}`;
  }

  const record = item as {
    id?: string;
    internalTrackingNumber?: string | null;
    externalTrackingNumber?: string | null;
  };

  return (
    record.id ||
    record.internalTrackingNumber ||
    record.externalTrackingNumber ||
    `package-row-${index}`
  );
}

function splitPackageIds(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function CustomsManifestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { pushToast } = useToast();
  const [flightNumber, setFlightNumber] = useState<string | null>(null);
  const [arrivalDate, setArrivalDate] = useState<string | null>(null);
  const [addPackageIds, setAddPackageIds] = useState("");
  const [removePackageIds, setRemovePackageIds] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: manifest,
    error,
    isLoading,
    mutate,
  } = useSWR(`/customs-manifests/${resolvedParams.id}`, () =>
    backofficeApi.getCustomsManifest(resolvedParams.id),
  );

  async function updateManifest() {
    if (!manifest) {
      return;
    }

    const flightNumberValue = flightNumber ?? manifest.flightNumber;
    const arrivalDateValue =
      arrivalDate ?? (manifest.arrivalDate ? manifest.arrivalDate.slice(0, 10) : "");

    setIsSubmitting(true);
    try {
      const updated = await backofficeApi.updateCustomsManifest(
        resolvedParams.id,
        {
          flightNumber: flightNumberValue,
          arrivalDate: arrivalDateValue || undefined,
        },
      );
      setFlightNumber(null);
      setArrivalDate(null);
      await mutate(updated, { revalidate: false });
      pushToast("Manifiesto actualizado.");
    } catch (err) {
      pushToast(
        err instanceof ApiError
          ? err.message
          : "Error al actualizar el manifiesto.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updatePackages(action: "add" | "remove") {
    const value = action === "add" ? addPackageIds : removePackageIds;
    const packageIds = splitPackageIds(value);

    if (packageIds.length === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (action === "add") {
        await backofficeApi.addPackagesToCustomsManifest(resolvedParams.id, {
          packageIds,
        });
        setAddPackageIds("");
      } else {
        await backofficeApi.removePackagesFromCustomsManifest(resolvedParams.id, {
          packageIds,
        });
        setRemovePackageIds("");
      }

      await mutate();
      pushToast("Paquetes actualizados.");
    } catch (err) {
      pushToast(
        err instanceof ApiError ? err.message : "Error al actualizar paquetes.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function transmitManifest() {
    setIsSubmitting(true);
    try {
      const updated = await backofficeApi.transmitCustomsManifest(
        resolvedParams.id,
      );
      await mutate(updated, { revalidate: false });
      pushToast("Manifiesto transmitido a SIGA.");
    } catch (err) {
      pushToast(
        err instanceof ApiError
          ? err.message
          : "Error al transmitir manifiesto a SIGA.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Cargando manifiesto...
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg m-4">
        Error al cargar el manifiesto.
      </div>
    );
  }

  const isDraft = manifest.status === "DRAFT";
  const manifestPackages = manifest.packages ?? [];
  const flightNumberValue = flightNumber ?? manifest.flightNumber;
  const arrivalDateValue =
    arrivalDate ?? (manifest.arrivalDate ? manifest.arrivalDate.slice(0, 10) : "");

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/customs-manifests"
              className="text-gray-400 hover:text-gray-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-semibold text-gray-900 m-0">
              Manifiesto {manifest.code}
            </h1>
            <CustomsManifestStatusBadge status={manifest.status} />
          </div>
          <p className="text-gray-500 mt-1 ml-8">
            Detalle operacional del manifiesto aduanero.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft ? (
            <Button onClick={() => void transmitManifest()} disabled={isSubmitting}>
              Transmitir a SIGA
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-1">
          <h2 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">
            Datos
          </h2>
          <div className="space-y-4">
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

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">
            Paquetes
          </h2>
          {isDraft ? (
            <div className="grid grid-cols-1 gap-4 mb-5">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1">
                  <FormField label="IDs de paquetes para agregar">
                    <Input
                      value={addPackageIds}
                      onChange={(event) => setAddPackageIds(event.target.value)}
                      placeholder="UUID-1, UUID-2"
                    />
                  </FormField>
                </div>
                <Button
                  onClick={() => void updatePackages("add")}
                  disabled={isSubmitting || !addPackageIds}
                >
                  Agregar paquetes
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1">
                  <FormField label="IDs de paquetes para quitar">
                    <Input
                      value={removePackageIds}
                      onChange={(event) =>
                        setRemovePackageIds(event.target.value)
                      }
                      placeholder="UUID-1, UUID-2"
                    />
                  </FormField>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => void updatePackages("remove")}
                  disabled={isSubmitting || !removePackageIds}
                >
                  Quitar paquetes
                </Button>
              </div>
            </div>
          ) : null}

          {manifestPackages.length === 0 ? (
            <div className="ui-state">No hay paquetes visibles en este manifiesto.</div>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Paquete</th>
                  </tr>
                </thead>
                <tbody>
                  {manifestPackages.map((item, index) => (
                    <tr key={packageRowKey(item, index)}>
                      <td>{packageLabel(item)}</td>
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
