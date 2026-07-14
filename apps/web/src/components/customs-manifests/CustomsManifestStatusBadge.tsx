import { Badge } from "@/components/ui/badge";
import type { CustomsManifestStatus } from "@/lib/api/contracts";

export function CustomsManifestStatusBadge({
  status,
}: {
  status: CustomsManifestStatus;
}) {
  switch (status) {
    case "DRAFT":
      return <Badge tone="neutral">Borrador</Badge>;
    case "VALIDATED":
      return <Badge tone="success">Validado</Badge>;
    case "FINALIZED":
      return <Badge tone="success">Finalizado</Badge>;
    case "CANCELLED":
      return <Badge tone="danger">Cancelado</Badge>;
    case "SUBMITTED":
      return <Badge tone="warning">Enviado</Badge>;
    case "APPROVED":
      return <Badge tone="success">Aprobado</Badge>;
    case "REJECTED":
      return <Badge tone="danger">Rechazado</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}
