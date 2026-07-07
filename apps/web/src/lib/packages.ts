import type { PackageSource, PackageStatus } from "@/lib/api/contracts";

export const PACKAGE_STATUS_LABELS: Record<PackageStatus, string> = {
  RECEPTION_PENDING: "Recepcion pendiente",
  RECEIVED_AT_ORIGIN: "Recibido en origen",
  CANCELLED: "Cancelado",
};

export const PACKAGE_SOURCE_LABELS: Record<PackageSource, string> = {
  MANUAL: "Manual",
  PREALERT: "Prealerta",
};

export function getPackageStatusTone(
  status: PackageStatus,
): "warning" | "success" | "danger" {
  if (status === "RECEPTION_PENDING") {
    return "warning";
  }

  return status === "RECEIVED_AT_ORIGIN" ? "success" : "danger";
}
