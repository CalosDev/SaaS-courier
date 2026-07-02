"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { useAsyncState } from "@/hooks/use-async-state";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";

export default function EmployeesPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activation, setActivation] = useState<{
    token: string;
    expiresAt: string;
  } | null>(null);

  const employees = useAsyncState(
    useCallback(
      () =>
      backofficeApi.listEmployees({
        page,
        pageSize: 10,
        q: q || undefined,
        status: status || undefined,
      }),
      [page, q, status],
    ),
  );
  const roles = useAsyncState(
    useCallback(() => backofficeApi.listRoles({ page: 1, pageSize: 100 }), []),
  );
  const facilities = useAsyncState(
    useCallback(
      () => backofficeApi.listFacilities({ page: 1, pageSize: 100, isActive: true }),
      [],
    ),
  );

  const activationUrl = useMemo(() => {
    if (!activation || typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}/activate#token=${activation.token}`;
  }, [activation]);

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const roleIds = formData.getAll("roleIds").map(String);
    const facilityIds = formData.getAll("facilityIds").map(String);
    const primaryFacilityId = String(formData.get("primaryFacilityId") || "") || null;

    setMessage(null);
    setError(null);

    try {
      const response = await backofficeApi.inviteEmployee({
        email: String(formData.get("email") || ""),
        employeeCode: String(formData.get("employeeCode") || "") || undefined,
        firstName: String(formData.get("firstName") || ""),
        lastName: String(formData.get("lastName") || ""),
        phone: String(formData.get("phone") || "") || undefined,
        roleIds,
        facilityIds,
        primaryFacilityId,
      });

      setMessage(`Invitación creada para ${response.employee.user.email}.`);
      setActivation(response.activation);
      await employees.refresh();
      event.currentTarget.reset();
    } catch (error) {
      setError(error instanceof ApiError ? error.message : "No fue posible invitar.");
    }
  }

  if (employees.status === "loading" || roles.status === "loading" || facilities.status === "loading") {
    return <LoadingState label="Cargando empleados..." />;
  }

  if (employees.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar empleados"
        description={employees.error.message}
        onRetry={() => void employees.refresh()}
      />
    );
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Empleados</h1>
          <p>Invitaciones, roles, facilities y estado operativo.</p>
        </div>
      </section>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        <div className="filters-row">
          <FormField label="Buscar">
            <Input value={q} onChange={(event) => setQ(event.target.value)} />
          </FormField>
          <FormField label="Estado">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              <option value="PENDING">PENDING</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="TERMINATED">TERMINATED</option>
            </Select>
          </FormField>
        </div>
      </Card>

      <Card>
        <Table
          columns={["Código", "Nombre", "Correo", "Estado", "Roles", "Acción"]}
          rows={employees.data.items.map((employee) => [
            employee.employeeCode || "Sin código",
            `${employee.firstName} ${employee.lastName}`,
            employee.user.email,
            employee.status,
            employee.roles.map((role) => role.code).join(", ") || "Sin roles",
            <Link key={employee.id} href={`/employees/${employee.id}`} className="inline-link">
              Ver detalle
            </Link>,
          ])}
        />
        <Pagination
          page={employees.data.pagination.page}
          totalPages={employees.data.pagination.totalPages}
          onPageChange={setPage}
        />
      </Card>

      <Card>
        <h2>Invitar empleado</h2>
        <form className="form-grid" onSubmit={handleInvite}>
          <FormField label="Correo">
            <Input name="email" type="email" required />
          </FormField>
          <FormField label="Código">
            <Input name="employeeCode" />
          </FormField>
          <FormField label="Nombres">
            <Input name="firstName" required />
          </FormField>
          <FormField label="Apellidos">
            <Input name="lastName" required />
          </FormField>
          <FormField label="Teléfono">
            <Input name="phone" />
          </FormField>
          <FormField label="Facility principal">
            <Select name="primaryFacilityId" defaultValue="">
              <option value="">Sin facility principal</option>
              {facilities.status === "success"
                ? facilities.data.items.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name}
                    </option>
                  ))
                : null}
            </Select>
          </FormField>

          <div className="selection-grid">
            <fieldset>
              <legend>Facilities</legend>
              {facilities.status === "success"
                ? facilities.data.items.map((facility) => (
                    <label key={facility.id} className="toggle-row">
                      <input type="checkbox" name="facilityIds" value={facility.id} />
                      <span>{facility.name}</span>
                    </label>
                  ))
                : null}
            </fieldset>
            <fieldset>
              <legend>Roles</legend>
              {roles.status === "success"
                ? roles.data.items.map((role) => (
                    <label key={role.id} className="toggle-row">
                      <input type="checkbox" name="roleIds" value={role.id} />
                      <span>{role.name}</span>
                    </label>
                  ))
                : null}
            </fieldset>
          </div>

          <Button type="submit">Crear invitación</Button>
        </form>
      </Card>

      <Dialog
        open={Boolean(activation)}
        title="Enlace de activación"
        onClose={() => setActivation(null)}
      >
        {activation ? (
          <div className="page-stack">
            <p>Este token se muestra una sola vez. Ciérralo para descartarlo.</p>
            <code className="inline-code">{activationUrl}</code>
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(activationUrl);
              }}
            >
              Copiar enlace
            </Button>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
