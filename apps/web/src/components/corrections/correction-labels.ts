import type { CorrectionRequest } from "@/lib/api/contracts";

export const CORRECTION_STATUS_LABELS: Record<CorrectionRequest["status"], string> = {
  REQUESTED: "Solicitada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  APPLIED: "Aplicada",
  CANCELLED: "Cancelada",
};
