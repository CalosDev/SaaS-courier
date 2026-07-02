"use client";

import { use, useCallback, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncState } from "@/hooks/use-async-state";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import type { PermissionItem } from "@/lib/api/contracts";

export default function RoleDetailPage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const { roleId } = use(params);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resource = useAsyncState(
    useCallback(
      async () => {
        const [role, permissions] = await Promise.all([
          backofficeApi.getRole(roleId),
          backofficeApi.listPermissions(),
        ]);

        return { role, permissions };
      },
      [roleId],
    ),
  );

  if (resource.status === "loading") {
    return <LoadingState label="Cargando rol..." />;
  }

  if (resource.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar el rol"
        description={resource.error.message}
        onRetry={() => void resource.refresh()}
      />
    );
  }

  const { role, permissions } = resource.data;

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    setError(null);

    try {
      await backofficeApi.updateRole(roleId, {
        code: String(formData.get("code") || ""),
        name: String(formData.get("name") || ""),
        description: String(formData.get("description") || "") || null,
        isActive: formData.get("isActive") === "on",
      });
      setMessage("Rol actualizado.");
      await resource.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "No fue posible guardar.");
    }
  }

  async function handlePermissions(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const permissionCodes = new FormData(event.currentTarget)
      .getAll("permissionCodes")
      .map(String);

    try {
      await backofficeApi.replaceRolePermissions(roleId, permissionCodes);
      setMessage("Permisos actualizados.");
      setError(null);
      await resource.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "No fue posible reemplazar permisos.",
      );
    }
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>{role.name}</h1>
          <p>{role.code}</p>
        </div>
      </section>

      {role.isSystem ? (
        <Alert tone="warning">Los roles del sistema son de solo lectura.</Alert>
      ) : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <section className="content-grid">
        <Card>
          <h2>Datos</h2>
          <form className="form-grid" onSubmit={handleUpdate}>
            <FormField label="Codigo">
              <Input name="code" defaultValue={role.code} disabled={role.isSystem} />
            </FormField>
            <FormField label="Nombre">
              <Input name="name" defaultValue={role.name} disabled={role.isSystem} />
            </FormField>
            <FormField label="Descripcion">
              <Textarea
                name="description"
                rows={4}
                defaultValue={role.description || ""}
                disabled={role.isSystem}
              />
            </FormField>
            <label className="toggle-row">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={role.isActive}
                disabled={role.isSystem}
              />
              <span>Activo</span>
            </label>
            <Button type="submit" disabled={role.isSystem}>
              Guardar rol
            </Button>
          </form>
        </Card>

        <Card>
          <h2>Permisos</h2>
          <form className="form-grid" onSubmit={handlePermissions}>
            <fieldset>
              <legend>Catalogo</legend>
              {permissions.map((permission: PermissionItem) => (
                <label key={permission.code} className="toggle-row">
                  <input
                    type="checkbox"
                    name="permissionCodes"
                    value={permission.code}
                    defaultChecked={role.permissionCodes.includes(permission.code)}
                    disabled={role.isSystem}
                  />
                  <span>{permission.name}</span>
                </label>
              ))}
            </fieldset>
            <Button type="submit" disabled={role.isSystem}>
              Reemplazar permisos
            </Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
