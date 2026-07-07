"use client";

import { use, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { PermissionBoundary } from "@/components/auth/permission-boundary";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Select } from "@/components/ui/select";
import { useAsyncState } from "@/hooks/use-async-state";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import type {
  Facility,
  OrganizationSettings,
  PackageCondition,
  PackageDetail,
  PackageReception,
} from "@/lib/api/contracts";
import { useAuth } from "@/lib/auth/auth-provider";
import { hasEveryPermission } from "@/lib/permissions";

const CONDITIONS: ReadonlyArray<{
  value: PackageCondition;
  label: string;
}> = [
  { value: "SEALED", label: "Sellado" },
  { value: "OPEN", label: "Abierto" },
  { value: "DAMAGED", label: "Danado" },
  { value: "WET", label: "Mojado" },
  { value: "CRUSHED", label: "Aplastado" },
  { value: "OTHER", label: "Otro" },
];

type ReceptionPageData = {
  packageRecord: PackageDetail;
  settings: OrganizationSettings | null;
  facilities: Facility[];
  reception: PackageReception | null;
};

const RECEIVE_PAGE_PERMISSIONS = [
  "packages.read",
  "packages.receive",
  "facilities.read",
  "organizations.read",
] as const;

export default function PackageReceptionPage({
  params,
}: {
  params: Promise<{ packageId: string }>;
}) {
  return (
    <PermissionBoundary
      requiredPermissions={RECEIVE_PAGE_PERMISSIONS}
      fallback={
        <ErrorState
          title="Acceso no autorizado"
          description="Tu sesion no tiene permisos para recibir paquetes."
        />
      }
    >
      <PackageReceptionContent params={params} />
    </PermissionBoundary>
  );
}

function PackageReceptionContent({
  params,
}: {
  params: Promise<{ packageId: string }>;
}) {
  const { packageId } = use(params);
  const { state } = useAuth();
  const permissionCodes =
    state.status === "authenticated" ? state.permissionCodes : [];
  const canLoadReception =
    state.status === "authenticated" &&
    hasEveryPermission(permissionCodes, RECEIVE_PAGE_PERMISSIONS);
  const resource = useAsyncState(
    useCallback(async (): Promise<ReceptionPageData> => {
      if (!canLoadReception) {
        throw new Error("Tu sesion no tiene permisos para recibir paquetes.");
      }

      const packageRecord = await backofficeApi.getPackage(packageId);

      if (packageRecord.status === "RECEIVED_AT_ORIGIN") {
        const reception = await backofficeApi.getPackageReception(packageId);
        return { packageRecord, settings: null, facilities: [], reception };
      }

      if (packageRecord.status !== "RECEPTION_PENDING") {
        return { packageRecord, settings: null, facilities: [], reception: null };
      }

      const [settings, facilities] = await Promise.all([
        backofficeApi.getCurrentSettings(),
        backofficeApi.listFacilities({ page: 1, pageSize: 100, isActive: true }),
      ]);

      return {
        packageRecord,
        settings,
        facilities: facilities.items,
        reception: null,
      };
    }, [canLoadReception, packageId]),
  );

  if (resource.status === "loading") {
    return <LoadingState label="Cargando recepcion..." />;
  }

  if (resource.status === "error") {
    return (
      <ErrorState
        title="No fue posible preparar la recepcion"
        description={resource.error.message}
        onRetry={() => void resource.refresh()}
      />
    );
  }

  const assignedFacilityIds =
    state.status === "authenticated" ? state.session.facilityIds : [];
  const availableFacilities = resource.data.facilities.filter(
    (facility) =>
      facility.isActive &&
      facility.isPackageOrigin &&
      assignedFacilityIds.includes(facility.id),
  );
  const primaryFacilityId =
    state.status === "authenticated" ? state.session.primaryFacilityId : undefined;
  const initialFacilityId =
    availableFacilities.find((facility) => facility.id === primaryFacilityId)?.id ??
    availableFacilities[0]?.id ??
    "";

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Recibir paquete</h1>
          <p>{resource.data.packageRecord.internalTrackingNumber}</p>
        </div>
      </section>

      {resource.data.reception ? (
        <ReceptionSummary reception={resource.data.reception} />
      ) : resource.data.packageRecord.status !== "RECEPTION_PENDING" ? (
        <ErrorState
          title="Recepcion no disponible"
          description="Este paquete ya no admite recepcion."
        />
      ) : !resource.data.settings ? (
        <ErrorState
          title="Configuracion no disponible"
          description="No fue posible cargar las unidades operativas."
        />
      ) : availableFacilities.length === 0 ? (
        <ErrorState
          title="Instalacion no disponible"
          description="Tu empleado no tiene una instalacion de origen activa asignada."
        />
      ) : (
        <ReceptionForm
          packageId={packageId}
          packageRecord={resource.data.packageRecord}
          settings={resource.data.settings}
          facilities={availableFacilities}
          initialFacilityId={initialFacilityId}
        />
      )}
    </div>
  );
}

function ReceptionSummary({ reception }: { reception: PackageReception }) {
  const condition = CONDITIONS.find(
    (item) => item.value === reception.condition,
  )?.label;

  return (
    <Card>
      <h2>Recepcion confirmada</h2>
      <ul className="detail-list">
        <li>
          <span>Instalacion</span>
          <strong>{reception.facility.name}</strong>
        </li>
        <li>
          <span>Peso</span>
          <strong>
            {reception.weight} {reception.weightUnit}
          </strong>
        </li>
        <li>
          <span>Dimensiones</span>
          <strong>
            {reception.length} x {reception.width} x {reception.height}{" "}
            {reception.dimensionUnit}
          </strong>
        </li>
        <li>
          <span>Piezas</span>
          <strong>{reception.pieceCount}</strong>
        </li>
        <li>
          <span>Condicion</span>
          <strong>{condition ?? reception.condition}</strong>
        </li>
        <li>
          <span>Recibido por</span>
          <strong>{reception.receivedBy.displayName}</strong>
        </li>
        <li>
          <span>Fecha</span>
          <strong>{reception.receivedAt.slice(0, 10)}</strong>
        </li>
      </ul>
    </Card>
  );
}

function ReceptionForm({
  packageId,
  packageRecord,
  settings,
  facilities,
  initialFacilityId,
}: {
  packageId: string;
  packageRecord: PackageDetail;
  settings: OrganizationSettings;
  facilities: Facility[];
  initialFacilityId: string;
}) {
  const router = useRouter();
  const [facilityId, setFacilityId] = useState(initialFacilityId);
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [pieceCount, setPieceCount] = useState("1");
  const [condition, setCondition] = useState<PackageCondition>("SEALED");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await backofficeApi.receivePackage(packageId, {
        facilityId,
        weight: Number(weight),
        length: Number(length),
        width: Number(width),
        height: Number(height),
        pieceCount: Number(pieceCount),
        condition,
      });
      router.push(`/packages/${packageId}`);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "No fue posible confirmar la recepcion.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="content-grid">
      <Card>
        <h2>Mediciones fisicas</h2>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <form className="form-grid" onSubmit={(event) => void handleSubmit(event)}>
          <FormField label="Instalacion de recepcion">
            <Select
              value={facilityId}
              onChange={(event) => setFacilityId(event.target.value)}
              disabled={submitting}
              required
            >
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.code} - {facility.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label={`Peso (${settings.weightUnit})`}>
            <Input
              type="number"
              min="0.001"
              max="100000"
              step="0.001"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              disabled={submitting}
              required
            />
          </FormField>

          <div className="form-grid">
            <MeasurementInput
              label={`Largo (${settings.dimensionUnit})`}
              value={length}
              onChange={setLength}
              disabled={submitting}
            />
            <MeasurementInput
              label={`Ancho (${settings.dimensionUnit})`}
              value={width}
              onChange={setWidth}
              disabled={submitting}
            />
            <MeasurementInput
              label={`Alto (${settings.dimensionUnit})`}
              value={height}
              onChange={setHeight}
              disabled={submitting}
            />
          </div>

          <FormField label="Piezas">
            <Input
              type="number"
              min="1"
              max="10000"
              step="1"
              value={pieceCount}
              onChange={(event) => setPieceCount(event.target.value)}
              disabled={submitting}
              required
            />
          </FormField>

          <FormField label="Condicion">
            <Select
              value={condition}
              onChange={(event) =>
                setCondition(event.target.value as PackageCondition)
              }
              disabled={submitting}
              required
            >
              {CONDITIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </FormField>

          <Button type="submit" disabled={submitting}>
            {submitting ? "Confirmando..." : "Confirmar recepcion"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2>Paquete</h2>
        <ul className="detail-list">
          <li>
            <span>Tracking interno</span>
            <strong>{packageRecord.internalTrackingNumber}</strong>
          </li>
          <li>
            <span>Tracking externo</span>
            <strong>{packageRecord.externalTrackingNumber}</strong>
          </li>
          <li>
            <span>Cliente</span>
            <strong>{packageRecord.customer.displayName}</strong>
          </li>
        </ul>
      </Card>
    </section>
  );
}

function MeasurementInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <FormField label={label}>
      <Input
        type="number"
        min="0.01"
        max="10000"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
      />
    </FormField>
  );
}
