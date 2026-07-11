import { Badge } from "@/components/ui/badge";
import { CUSTOMS_CASE_STATUS_LABELS } from "@/components/customs-cases/customs-case-labels";
import type { CustomsCaseStatus } from "@/lib/api/contracts";

export function CustomsCaseStatusBadge({
  status,
}: {
  status: CustomsCaseStatus;
}) {
  switch (status) {
    case "PENDING_REVIEW":
      return <Badge tone="warning">{CUSTOMS_CASE_STATUS_LABELS[status]}</Badge>;
    case "UNDER_REVIEW":
      return <Badge tone="neutral">{CUSTOMS_CASE_STATUS_LABELS[status]}</Badge>;
    case "RELEASED":
      return <Badge tone="success">{CUSTOMS_CASE_STATUS_LABELS[status]}</Badge>;
    case "HELD":
    case "REJECTED":
      return <Badge tone="danger">{CUSTOMS_CASE_STATUS_LABELS[status]}</Badge>;
    case "CANCELLED":
      return <Badge tone="neutral">{CUSTOMS_CASE_STATUS_LABELS[status]}</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}
