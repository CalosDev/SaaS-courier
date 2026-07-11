import { Badge } from "@/components/ui/badge";
import { DispatchStatus } from "@/lib/api/contracts";

export function DispatchStatusBadge({ status }: { status: DispatchStatus }) {
  switch (status) {
    case "DRAFT":
      return <Badge tone="neutral">Borrador</Badge>;
    case "SCHEDULED":
      return <Badge tone="neutral">Programado</Badge>;
    case "IN_TRANSIT":
      return <Badge tone="warning">En Tránsito</Badge>;
    case "ARRIVED":
      return <Badge tone="neutral">Llegó a Destino</Badge>;
    case "COMPLETED":
      return <Badge tone="success">Completado</Badge>;
    case "CANCELLED":
      return <Badge tone="danger">Cancelado</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}
