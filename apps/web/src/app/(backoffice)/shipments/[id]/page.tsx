"use client";

import { use, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { backofficeApi } from "@/lib/api/backoffice";
import { DispatchStatusBadge } from "@/components/dispatches/DispatchStatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/api-error";

export default function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { pushToast } = useToast();
  const [mawb, setMawb] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: shipment,
    error,
    isLoading,
    mutate,
  } = useSWR(`/master-shipments/${resolvedParams.id}`, () =>
    backofficeApi.getMasterShipment(resolvedParams.id),
  );

  async function runAction(
    action: "close" | "depart" | "arrive" | "cancel",
  ) {
    setIsSubmitting(true);
    try {
      const updated =
        action === "close"
          ? await backofficeApi.closeMasterShipment(resolvedParams.id)
          : action === "depart"
            ? await backofficeApi.departMasterShipment(resolvedParams.id)
            : action === "arrive"
              ? await backofficeApi.arriveMasterShipment(resolvedParams.id)
              : await backofficeApi.cancelMasterShipment(resolvedParams.id);

      await mutate(updated, { revalidate: false });
      pushToast("Embarque actualizado.");
    } catch (err) {
      pushToast(
        err instanceof ApiError ? err.message : "Error al actualizar el embarque.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateMawb() {
    const mawbValue = mawb ?? shipment?.mawb ?? "";
    setIsSubmitting(true);
    try {
      const updated = await backofficeApi.updateMasterShipmentMawb(
        resolvedParams.id,
        { mawb: mawbValue },
      );
      await mutate(updated, { revalidate: false });
      pushToast("MAWB actualizado.");
    } catch (err) {
      pushToast(
        err instanceof ApiError ? err.message : "Error al actualizar el MAWB.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-500">Cargando embarque...</div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg m-4">
        Error al cargar el embarque.
      </div>
    );
  }

  const mawbValue = mawb ?? shipment.mawb ?? "";

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/shipments" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-semibold text-gray-900 m-0">
              Embarque {shipment.dispatchCode}
            </h1>
            <DispatchStatusBadge status={shipment.status} />
          </div>
          <p className="text-gray-500 mt-1 ml-8">
            Detalles y ciclo operativo del embarque maestro.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {shipment.status === "DRAFT" ? (
            <>
              <Button
                onClick={() => void runAction("close")}
                disabled={isSubmitting}
              >
                Cerrar
              </Button>
              <Button
                variant="secondary"
                onClick={() => void runAction("cancel")}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
            </>
          ) : null}
          {shipment.status === "CLOSED" ? (
            <>
              <Button
                onClick={() => void runAction("depart")}
                disabled={isSubmitting}
              >
                Marcar salida
              </Button>
              <Button
                variant="secondary"
                onClick={() => void runAction("cancel")}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
            </>
          ) : null}
          {shipment.status === "DEPARTED" ? (
            <Button
              onClick={() => void runAction("arrive")}
              disabled={isSubmitting}
            >
              Marcar llegada
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-1">
          <h2 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">
            Información General
          </h2>
          <div className="space-y-4">
            <div>
              <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ruta
              </span>
              <span className="block text-sm text-gray-900 mt-1 font-medium">
                {shipment.origin || "-"} -&gt; {shipment.destination || "-"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transportista
                </span>
                <span className="block text-sm text-gray-900 mt-1">
                  {shipment.carrier || "-"}
                </span>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vuelo
                </span>
                <span className="block text-sm text-gray-900 mt-1">
                  {shipment.flightNumber || "-"}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">
            MAWB
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <FormField label="Master Airway Bill">
                <Input
                  value={mawbValue}
                  onChange={(event) => setMawb(event.target.value)}
                  disabled={shipment.status === "CANCELLED"}
                  placeholder="Ej. 123-45678901"
                />
              </FormField>
            </div>
            <Button
              onClick={() => void updateMawb()}
              disabled={
                isSubmitting || shipment.status === "CANCELLED" || !mawbValue
              }
            >
              Guardar MAWB
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
