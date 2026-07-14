"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import useSWR from "swr";
import { backofficeApi } from "@/lib/api/backoffice";
import type { PickupRequestRecord } from "@/lib/api/contracts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table } from "@/components/ui/table";

const labels = { DRAFT: "Borrador", READY: "Lista", COMPLETED: "Completada", CANCELLED: "Cancelada" };
const tones = { DRAFT: "neutral", READY: "warning", COMPLETED: "success", CANCELLED: "danger" } as const;

export default function PickupRequestsPage() {
  const { data = [], error, isLoading, mutate } = useSWR("/pickup-requests", () => backofficeApi.listPickupRequests());
  return <div className="page-stack">
    <section className="page-header"><div><h1>Solicitudes de retiro</h1><p>Entrega de paquetes elegibles en sucursal.</p></div>
      <Link className="inline-flex items-center justify-center gap-2 rounded-lg px-4 min-h-[42px] font-medium bg-primary text-white" href="/pickup-requests/new"><Plus className="button-icon" />Nueva solicitud</Link>
    </section>
    <Card>{isLoading ? <LoadingState label="Cargando solicitudes..." /> : error ? <ErrorState title="Error al cargar solicitudes" description={error.message} onRetry={() => void mutate()} /> : data.length === 0 ? <EmptyState title="No hay solicitudes" description="Crea la primera solicitud de retiro." /> : <Table columns={["Número", "Estado", "Paquetes", "Fecha"]} rows={data.map((item: PickupRequestRecord) => [<Link key={item.id} className="inline-code" href={`/pickup-requests/${item.id}`}>{item.pickupNumber}</Link>, <Badge key={`s-${item.id}`} tone={tones[item.status]}>{labels[item.status]}</Badge>, item.items?.length ?? 0, new Date(item.createdAt).toLocaleDateString("es-DO")])} />}</Card>
  </div>;
}
