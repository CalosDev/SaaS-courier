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
import type { CreateHouseShipmentDto, HouseShipment } from "@/lib/api/contracts";

export default function ShipmentConsolidationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { pushToast } = useToast();
  const [formData, setFormData] = useState<CreateHouseShipmentDto>({
    hawb: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: shipment } = useSWR(
    `/master-shipments/${resolvedParams.id}`,
    () => backofficeApi.getMasterShipment(resolvedParams.id),
  );
  const {
    data: houseShipments,
    error,
    isLoading,
    mutate,
  } = useSWR<HouseShipment[]>(
    ["/master-shipments", resolvedParams.id, "house-shipments"],
    () => backofficeApi.listHouseShipments(resolvedParams.id),
  );

  async function createHouseShipment(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await backofficeApi.createHouseShipment(resolvedParams.id, {
        hawb: formData.hawb,
        notes: formData.notes || undefined,
      });
      setFormData({ hawb: "", notes: "" });
      await mutate();
      pushToast("HAWB creado.");
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Error al crear el HAWB.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href={`/shipments/${resolvedParams.id}`}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 m-0">
            Consolidaciones
          </h1>
          <p className="text-gray-500 mt-1">
            {shipment
              ? `HAWBs del embarque ${shipment.dispatchCode}`
              : "HAWBs del embarque seleccionado"}
          </p>
        </div>
      </div>

      <Card className="p-5">
        <h2 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">
          Crear HAWB
        </h2>
        <form
          onSubmit={(event) => void createHouseShipment(event)}
          className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-4 md:items-end"
        >
          <FormField label="HAWB">
            <Input
              value={formData.hawb}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  hawb: event.target.value,
                }))
              }
              required
              placeholder="Ej. HAWB-001"
            />
          </FormField>
          <FormField label="Notas">
            <Textarea
              value={formData.notes || ""}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Notas operativas"
            />
          </FormField>
          <Button type="submit" disabled={isSubmitting || !formData.hawb}>
            {isSubmitting ? "Creando..." : "Crear HAWB"}
          </Button>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="ui-state">Cargando HAWBs...</div>
        ) : error ? (
          <div className="ui-state ui-state--error">Error al cargar HAWBs.</div>
        ) : !houseShipments || houseShipments.length === 0 ? (
          <div className="ui-state">No hay HAWBs para este embarque.</div>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>HAWB</th>
                  <th>Estado</th>
                  <th>Paquetes</th>
                  <th>Notas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {houseShipments.map((houseShipment) => (
                  <tr key={houseShipment.id}>
                    <td>
                      <span className="inline-code">{houseShipment.hawb}</span>
                    </td>
                    <td>
                      <HouseShipmentStatusBadge status={houseShipment.status} />
                    </td>
                    <td>{houseShipment.packages?.length ?? 0}</td>
                    <td>{houseShipment.notes || "-"}</td>
                    <td>
                      <Link
                        href={`/house-shipments/${houseShipment.id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
