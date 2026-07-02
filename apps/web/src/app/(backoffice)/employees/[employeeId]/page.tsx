"use client";

import { use, useCallback, useState } from "react";

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
import type { Facility, Role } from "@/lib/api/contracts";
import { useAuth } from "@/lib/auth/auth-provider";

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = use(params);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { state } = useAuth();

  const resource = useAsyncState(
    useCallback(
      async () => {
        const [employee, roles, facilities] = await Promise.all([
          backofficeApi.getEmployee(employeeId),
          backofficeApi.listRoles({ page: 1, pageSize: 100 }),
          backofficeApi.listFacilities({ page: 1, pageSize: 100, isActive: true }),
        ]);

        return { employee, roles, facilities };
      },
      [employeeId],
    ),
  );

  if (resource.status === "loading") {
    return <LoadingState label="Cargando empleado..." />;
  }

  if (resource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar el empleado"
        description={resource.error.message}
        onRetry={() => void resource.refresh()}
      />
    );
  }

  const { employee, roles, facilities } = resource.data;
  const isSelf = state.status === "authenticated" && state.session.employeeId === employeeId;

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setMessage(null);

    try {
      await backofficeApi.updateEmployee(employeeId, {
        employeeCode: String(formData.get("employeeCode") || "") || null,
        firstName: String(formData.get("firstName") || ""),
        lastName: String(formData.get("lastName") || ""),
        phone: String(formData.get("phone") || "") || null,
        status: String(formData.get("status") || ""),
      });
      setMessage("Empleado actualizado.");
      await resource.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "No fue posible guardar.");
    }
  }

  async function handleRoles(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const roleIds = new FormData(event.currentTarget).getAll("roleIds").map(String);

    try {
      await backofficeApi.replaceEmployeeRoles(employeeId, roleIds);
      setMessage("Roles actualizados.");
      setError(null);
      await resource.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "No fue posible guardar roles.");
    }
  }

  async function handleFacilities(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const facilityIds = formData.getAll("facilityIds").map(String);
    const primaryFacilityId = String(formData.get("primaryFacilityId") || "") || null;

    try {
      await backofficeApi.replaceEmployeeFacilities(
        employeeId,
        facilityIds,
        primaryFacilityId,
      );
      setMessage("Facilities actualizadas.");
      setError(null);
      await resource.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "No fue posible guardar facilities.",
      );
    }
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>
            {employee.firstName} {employee.lastName}
          </h1>
          <p>{employee.user.email}</p>
        </div>
      </section>

      {isSelf ? (
        <Alert tone="warning">
          Tu propio usuario no puede cambiar sus roles, facilities ni estado desde esta
          pantalla.
        </Alert>
      ) : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <section className="content-grid">
        <Card>
          <h2>Datos basicos</h2>
          <form className="form-grid" onSubmit={handleUpdate}>
            <FormField label="Codigo">
              <Input name="employeeCode" defaultValue={employee.employeeCode || ""} />
            </FormField>
            <FormField label="Nombres">
              <Input name="firstName" defaultValue={employee.firstName} required />
            </FormField>
            <FormField label="Apellidos">
              <Input name="lastName" defaultValue={employee.lastName} required />
            </FormField>
            <FormField label="Telefono">
              <Input name="phone" defaultValue={employee.phone || ""} />
            </FormField>
            <FormField label="Estado">
              <Select name="status" defaultValue={employee.status} disabled={isSelf}>
                <option value="PENDING">PENDING</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="TERMINATED">TERMINATED</option>
              </Select>
            </FormField>
            <Button type="submit" disabled={isSelf}>
              Guardar datos
            </Button>
          </form>
        </Card>

        <Card>
          <h2>Roles</h2>
          <form className="form-grid" onSubmit={handleRoles}>
            <fieldset>
              <legend>Asignaciones</legend>
              {roles.items.map((role: Role) => (
                <label key={role.id} className="toggle-row">
                  <input
                    type="checkbox"
                    name="roleIds"
                    value={role.id}
                    defaultChecked={employee.roles.some((item) => item.id === role.id)}
                    disabled={isSelf || role.isSystem}
                  />
                  <span>{role.name}</span>
                </label>
              ))}
            </fieldset>
            <Button type="submit" disabled={isSelf}>
              Guardar roles
            </Button>
          </form>
        </Card>

        <Card>
          <h2>Facilities</h2>
          <form className="form-grid" onSubmit={handleFacilities}>
            <FormField label="Facility principal">
              <Select
                name="primaryFacilityId"
                defaultValue={
                  employee.facilities.find((facility) => facility.isPrimary)?.id || ""
                }
                disabled={isSelf}
              >
                <option value="">Sin principal</option>
                {facilities.items.map((facility: Facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <fieldset>
              <legend>Accesos</legend>
              {facilities.items.map((facility: Facility) => (
                <label key={facility.id} className="toggle-row">
                  <input
                    type="checkbox"
                    name="facilityIds"
                    value={facility.id}
                    defaultChecked={employee.facilities.some((item) => item.id === facility.id)}
                    disabled={isSelf}
                  />
                  <span>{facility.name}</span>
                </label>
              ))}
            </fieldset>
            <Button type="submit" disabled={isSelf}>
              Guardar facilities
            </Button>
          </form>
        </Card>

        <Card>
          <h2>Sesiones</h2>
          <Button
            variant="danger"
            disabled={isSelf}
            onClick={async () => {
              try {
                await backofficeApi.revokeEmployeeSessions(employeeId);
                setMessage("Sesiones revocadas.");
              } catch (cause) {
                setError(
                  cause instanceof ApiError
                    ? cause.message
                    : "No fue posible revocar sesiones.",
                );
              }
            }}
          >
            Revocar sesiones activas
          </Button>
        </Card>
      </section>
    </div>
  );
}
