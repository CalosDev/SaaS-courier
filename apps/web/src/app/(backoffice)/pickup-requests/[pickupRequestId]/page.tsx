"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { backofficeApi } from "@/lib/api/backoffice";
import { ApiError } from "@/lib/api/api-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

export default function PickupRequestDetailPage() {
  const id = useParams<{ pickupRequestId: string }>().pickupRequestId;
  const { pushToast } = useToast();
  const { data, error, isLoading, mutate } = useSWR(`/pickup-requests/${id}`, () => backofficeApi.getPickupRequest(id));
  async function action(run: () => Promise<unknown>, message: string) { try { await run(); pushToast(message); await mutate(); } catch (cause) { pushToast(cause instanceof ApiError ? cause.message : "No fue posible actualizar la solicitud."); } }
  if (isLoading) return <LoadingState label="Cargando solicitud..." />;
  if (error || !data) return <ErrorState title="No se pudo cargar la solicitud" description={error?.message ?? "Solicitud no encontrada"} onRetry={() => void mutate()} />;
  return <div className="page-stack"><section className="page-header"><div><h1>{data.pickupNumber}</h1><p>Solicitud de retiro en sucursal.</p></div><Badge tone={data.status === "COMPLETED" ? "success" : data.status === "CANCELLED" ? "danger" : "neutral"}>{data.status}</Badge></section>
    <Card><Table columns={["Paquete"]} rows={(data.items ?? []).map((item) => [item.packageId])} /></Card>
    <div className="flex gap-2">{data.status === "DRAFT" ? <Button onClick={() => void action(() => backofficeApi.markPickupRequestReady(id), "Solicitud lista para retiro.")}>Marcar lista</Button> : null}{data.status === "READY" ? <Button onClick={() => void action(() => backofficeApi.completePickupRequest(id), "Retiro completado.")}>Completar retiro</Button> : null}{data.status === "DRAFT" || data.status === "READY" ? <Button variant="danger" onClick={() => void action(() => backofficeApi.cancelPickupRequest(id), "Solicitud cancelada.")}>Cancelar</Button> : null}</div>
  </div>;
}
