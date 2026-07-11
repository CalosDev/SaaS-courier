"use client";

import { use, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { HouseShipmentStatusBadge } from "@/components/house-shipments/HouseShipmentStatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";

function packageLabel(item: unknown) {
  if (!item || typeof item !== "object") {
    return "-";
  }

  const record = item as {
    packageId?: string;
    package?: {
      internalTrackingNumber?: string | null;
      externalTrackingNumber?: string | null;
    };
  };

  return (
    record.package?.internalTrackingNumber ||
    record.package?.externalTrackingNumber ||
    record.packageId ||
    "-"
  );
}

function packageRowKey(item: unknown, index: number) {
  if (!item || typeof item !== "object") {
    return `package-row-${index}`;
  }

  const record = item as {
    id?: string;
    packageId?: string;
    package?: {
      id?: string;
      internalTrackingNumber?: string | null;
      externalTrackingNumber?: string | null;
    };
  };

  return (
    record.id ||
    record.packageId ||
    record.package?.id ||
    record.package?.internalTrackingNumber ||
    record.package?.externalTrackingNumber ||
    `package-row-${index}`
  );
}

export default function HouseShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { pushToast } = useToast();
  const [hawb, setHawb] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [packageIds, setPackageIds] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: houseShipment,
    error,
    isLoading,
    mutate,
  } = useSWR(`/house-shipments/${resolvedParams.id}`, () =>
    backofficeApi.getHouseShipment(resolvedParams.id),
  );

  async function updateHouseShipment() {
    if (!houseShipment) {
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await backofficeApi.updateHouseShipment(resolvedParams.id, {
        hawb: hawb ?? houseShipment.hawb,
        notes: notes ?? houseShipment.notes,
      });
      await mutate(updated, { revalidate: false });
      pushToast("HAWB actualizado.");
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Error al actualizar el HAWB.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function replacePackages() {
    const ids = packageIds
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await backofficeApi.addPackagesToHouseShipment(resolvedParams.id, {
        packageIds: ids,
      });
      setPackageIds("");
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

  async function runAction(action: "close" | "cancel") {
    setIsSubmitting(true);
    try {
      if (action === "close") {
        await backofficeApi.closeHouseShipment(resolvedParams.id);
      } else {
        await backofficeApi.cancelHouseShipment(resolvedParams.id);
      }

      await mutate();
      pushToast("HAWB actualizado.");
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Error al actualizar el HAWB.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando HAWB...</div>;
  }

  if (error || !houseShipment) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg m-4">
        Error al cargar el HAWB.
      </div>
    );
  }

  const hawbValue = hawb ?? houseShipment.hawb;
  const notesValue = notes ?? houseShipment.notes ?? "";
  const isDraft = houseShipment.status === "DRAFT";
  const backHref = `/shipments/${houseShipment.dispatchId}/consolidations`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href={backHref} className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-semibold text-gray-900 m-0">
              HAWB {houseShipment.hawb}
            </h1>
            <HouseShipmentStatusBadge status={houseShipment.status} />
          </div>
          <p className="text-gray-500 mt-1 ml-8">
            Consolidación del embarque maestro.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft ? (
            <Button
              onClick={() => void runAction("close")}
              disabled={isSubmitting}
            >
              Cerrar
            </Button>
          ) : null}
          {houseShipment.status !== "CANCELLED" ? (
            <Button
              variant="secondary"
              onClick={() => void runAction("cancel")}
              disabled={isSubmitting}
            >
              Cancelar
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
            <FormField label="HAWB">
              <Input
                value={hawbValue}
                onChange={(event) => setHawb(event.target.value)}
                disabled={!isDraft}
              />
            </FormField>
            <FormField label="Notas">
              <Textarea
                value={notesValue}
                onChange={(event) => setNotes(event.target.value)}
                disabled={!isDraft}
              />
            </FormField>
            <Button
              onClick={() => void updateHouseShipment()}
              disabled={isSubmitting || !isDraft || !hawbValue}
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
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end mb-5">
              <div className="flex-1">
                <FormField label="IDs de paquetes">
                  <Input
                    value={packageIds}
                    onChange={(event) => setPackageIds(event.target.value)}
                    placeholder="UUID-1, UUID-2"
                  />
                </FormField>
              </div>
              <Button
                onClick={() => void replacePackages()}
                disabled={isSubmitting || !packageIds}
              >
                Reemplazar paquetes
              </Button>
            </div>
          ) : null}

          {!houseShipment.packages || houseShipment.packages.length === 0 ? (
            <div className="ui-state">No hay paquetes asignados.</div>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Paquete</th>
                  </tr>
                </thead>
                <tbody>
                  {houseShipment.packages.map((item, index) => (
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
