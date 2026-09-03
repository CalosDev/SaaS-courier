import { CORRECTION_STATUS_LABELS } from "@/components/corrections/correction-labels";
import { Badge } from "@/components/ui/badge";
import type { CorrectionRequest } from "@/lib/api/contracts";

const CORRECTION_STATUS_TONES: Record<
  CorrectionRequest["status"],
  "neutral" | "success" | "warning" | "danger"
> = {
  REQUESTED: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  APPLIED: "success",
  CANCELLED: "neutral",
};

export function CorrectionStatusBadge({
  status,
}: {
  status: CorrectionRequest["status"];
}) {
  return (
    <Badge tone={CORRECTION_STATUS_TONES[status]}>
      {CORRECTION_STATUS_LABELS[status]}
    </Badge>
  );
}
