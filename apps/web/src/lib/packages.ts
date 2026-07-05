import type { PackageSource, PackageStatus } from "@/lib/api/contracts";

export const PACKAGE_STATUS_LABELS: Record<PackageStatus, string> = {
  RECEPTION_PENDING: "Recepcion pendiente",
  CANCELLED: "Cancelado",
};

export const PACKAGE_SOURCE_LABELS: Record<PackageSource, string> = {
  MANUAL: "Manual",
  PREALERT: "Prealerta",
};

export function getPackageStatusTone(
  status: PackageStatus,
): "warning" | "danger" {
  return status === "RECEPTION_PENDING" ? "warning" : "danger";
}
