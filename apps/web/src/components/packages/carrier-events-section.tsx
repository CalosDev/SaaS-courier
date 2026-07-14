"use client";

import { useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table } from "@/components/ui/table";
import { useAsyncState } from "@/hooks/use-async-state";
import { backofficeApi } from "@/lib/api/backoffice";

export function CarrierEventsSection({ packageId }: { packageId: string }) {
  const resource = useAsyncState(useCallback(() => backofficeApi.listPackageCarrierEvents(packageId), [packageId]));
  if (resource.status === "loading") return <LoadingState label="Cargando eventos carrier..." />;
  if (resource.status === "error") return <ErrorState title="No fue posible cargar eventos carrier" description={resource.error.message} onRetry={() => void resource.refresh()} />;
  if (!resource.data.items.length) return <EmptyState title="Sin eventos carrier" description="Los webhooks firmados aparecerán aquí sin modificar la recepción interna." />;
  return <Table columns={["Fecha", "Carrier", "Estado", "Ubicación", "Descripción"]} rows={resource.data.items.map((event) => [event.occurredAt.slice(0,16).replace("T"," "), event.carrier.displayName, <Badge key={event.id} tone={event.status === "DELIVERED" ? "success" : event.status === "EXCEPTION" ? "danger" : "warning"}>{event.status}</Badge>, event.location || "—", event.description || "—"])} />;
}
