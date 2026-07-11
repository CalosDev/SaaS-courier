import type {
  CustomsCaseStatus,
  CustomsEventSource,
} from "@/lib/api/contracts";

export const CUSTOMS_CASE_STATUS_LABELS: Record<CustomsCaseStatus, string> = {
  PENDING_REVIEW: "Pendiente revisión",
  UNDER_REVIEW: "En revisión",
  RELEASED: "Liberado",
  HELD: "Retenido",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

export const CUSTOMS_EVENT_SOURCE_LABELS: Record<CustomsEventSource, string> = {
  MANUAL: "Manual",
  OFFICIAL_PORTAL: "Portal oficial",
  AUTHORIZED_INTEGRATION: "Integración autorizada",
};
