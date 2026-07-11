import { Badge } from "@/components/ui/badge";
import type { HouseShipmentStatus } from "@/lib/api/contracts";

export function HouseShipmentStatusBadge({
  status,
}: {
  status: HouseShipmentStatus;
}) {
  switch (status) {
    case "DRAFT":
      return <Badge tone="neutral">Borrador</Badge>;
    case "CLOSED":
      return <Badge tone="success">Cerrado</Badge>;
    case "CANCELLED":
      return <Badge tone="danger">Cancelado</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}
