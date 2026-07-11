"use client";

import useSWR from "swr";
import { useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Box, PackagePlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { backofficeApi } from "@/lib/api/backoffice";
import { DispatchStatusBadge } from "@/components/dispatches/DispatchStatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/api-error";

const scanPackageSchema = z.object({
  trackingOrCode: z.string().min(1, "Ingresa un código o tracking válido"),
});
type ScanPackageForm = z.infer<typeof scanPackageSchema>;

export default function DispatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { pushToast } = useToast();
  const [isScanning, setIsScanning] = useState(false);

  const { data: dispatch, error, isLoading, mutate: refetchDispatch } = useSWR(
    `/dispatches/${resolvedParams.id}`,
    () => backofficeApi.getDispatch(resolvedParams.id)
  );

  const form = useForm<ScanPackageForm>({
    resolver: zodResolver(scanPackageSchema),
    defaultValues: { trackingOrCode: "" },
  });

  async function onScanSubmit(values: ScanPackageForm) {
    try {
      // 1. Find package by tracking or code
      const searchRes = await backofficeApi.listPackages({ q: values.trackingOrCode, pageSize: 1 });
      if (!searchRes.items || searchRes.items.length === 0) {
        pushToast("No se encontró ningún paquete con ese código.");
        return;
      }

      const targetPackage = searchRes.items[0];

      // 2. Add to dispatch
      await backofficeApi.addPackagesToDispatch(resolvedParams.id, {
        packageIds: [targetPackage.id]
      });

      pushToast(`Paquete ${targetPackage.internalTrackingNumber || targetPackage.externalTrackingNumber} agregado exitosamente.`);
      form.reset();

      // Keep focus on input for fast scanning
      setTimeout(() => document.getElementById("scan-input")?.focus(), 100);

      await refetchDispatch();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Error al procesar el paquete.");
    }
  }

  if (isLoading) return <div className="p-8 text-center text-gray-500">Cargando despacho...</div>;
  if (error || !dispatch) return <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg m-4">Error al cargar el despacho.</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/dispatches" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-semibold text-gray-900 m-0">
              Despacho {dispatch.dispatchCode}
            </h1>
            <DispatchStatusBadge status={dispatch.status} />
          </div>
          <p className="text-gray-500 mt-1 ml-8">Detalles y paquetes asociados al despacho.</p>
        </div>
        <div className="flex gap-2">
          {dispatch.status === "DRAFT" && (
            <Button onClick={() => setIsScanning(true)}>
              <PackagePlus className="w-4 h-4" />
              Agregar Paquetes
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Card */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-5">
            <h2 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Información General</h2>
            <div className="space-y-4">
              <div>
                <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Ruta</span>
                <span className="block text-sm text-gray-900 mt-1 font-medium">
                  {dispatch.origin || "—"} → {dispatch.destination || "—"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Transportista</span>
                  <span className="block text-sm text-gray-900 mt-1">{dispatch.carrier || "—"}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Vuelo</span>
                  <span className="block text-sm text-gray-900 mt-1">{dispatch.flightNumber || "—"}</span>
                </div>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider">MAWB (Guía Master)</span>
                <span className="block text-sm text-gray-900 mt-1 font-mono bg-gray-100 px-2 py-1 rounded inline-block">{dispatch.mawb || "—"}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Salida Estimada</span>
                  <span className="block text-sm text-gray-900 mt-1">
                    {dispatch.departureTime ? new Date(dispatch.departureTime).toLocaleDateString() : "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Llegada Estimada</span>
                  <span className="block text-sm text-gray-900 mt-1">
                    {dispatch.estimatedArrivalTime ? new Date(dispatch.estimatedArrivalTime).toLocaleDateString() : "—"}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Packages List Placeholder */}
        <div className="lg:col-span-2">
          <Card className="p-0 overflow-hidden flex flex-col h-full min-h-[400px]">
            <div className="p-5 border-b bg-gray-50/50 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2 m-0">
                <Box className="w-5 h-5 text-gray-400" />
                Manifiesto de Paquetes
              </h2>
            </div>
            <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <PackagePlus className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No hay paquetes</h3>
              <p className="text-gray-500 mt-1 max-w-sm">
                Actualmente no hay paquetes agregados a este despacho.
                Usa el botón superior para empezar a escanear paquetes.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Scan Modal */}
      <Dialog
        open={isScanning}
        title="Agregar paquetes al despacho"
        onClose={() => setIsScanning(false)}
        actions={
          <Button variant="secondary" onClick={() => setIsScanning(false)}>
            Cerrar escáner
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-500">
            Escanea el código de barras del paquete o ingresa el tracking manualmente.
            El paquete se vinculará al despacho <span className="font-semibold">{dispatch.dispatchCode}</span>.
          </p>
          <form onSubmit={form.handleSubmit(onScanSubmit)} className="flex items-end gap-3">
            <div className="flex-1">
              <FormField label="Código o Tracking" error={form.formState.errors.trackingOrCode?.message}>
                <Input
                  id="scan-input"
                  autoFocus
                  autoComplete="off"
                  placeholder="Ej. T-123456789"
                  {...form.register("trackingOrCode")}
                />
              </FormField>
            </div>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Agregando..." : "Agregar"}
            </Button>
          </form>
          <div className="bg-blue-50 text-blue-800 text-sm p-3 rounded flex items-center gap-2">
            ℹ️ Puedes seguir escaneando múltiples paquetes de forma consecutiva.
          </div>
        </div>
      </Dialog>
    </div>
  );
}
