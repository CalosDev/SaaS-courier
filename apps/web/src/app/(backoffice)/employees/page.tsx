"use client";

import useSWR from "swr";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Copy, Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import type { Employee } from "@/lib/api/contracts";

const inviteSchema = z.object({
  email: z.string().email("Correo inválido"),
  firstName: z.string().min(2, "El nombre es requerido"),
  lastName: z.string().min(2, "El apellido es requerido"),
  employeeCode: z.string().optional(),
  phone: z.string().optional(),
  primaryFacilityId: z.string().optional(),
  roleIds: z.array(z.string()).min(1, "Selecciona al menos un rol"),
  facilityIds: z.array(z.string()).optional(),
});

type InviteForm = z.infer<typeof inviteSchema>;

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  TERMINATED: "Terminado",
};

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  ACTIVE: "success",
  SUSPENDED: "danger",
  TERMINATED: "neutral",
};

export default function EmployeesPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const { pushToast } = useToast();
  const [activation, setActivation] = useState<{ token: string; expiresAt: string } | null>(null);

  const { data: employeesData, isLoading, error, mutate: refetch } = useSWR(
    `/employees?page=${page}&q=${q}&status=${status}`,
    () => backofficeApi.listEmployees({ page, pageSize: 10, q: q || undefined, status: status || undefined })
  );

  const { data: rolesData } = useSWR("/roles", () => backofficeApi.listRoles({ page: 1, pageSize: 100 }));
  const { data: facilitiesData } = useSWR("/facilities", () => backofficeApi.listFacilities({ page: 1, pageSize: 100, isActive: true }));

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "", firstName: "", lastName: "", employeeCode: "", phone: "", primaryFacilityId: "", roleIds: [], facilityIds: []
    }
  });

  const activationUrl = useMemo(() => {
    if (!activation || typeof window === "undefined") return "";
    return `${window.location.origin}/activate#token=${activation.token}`;
  }, [activation]);

  const handleCopy = async () => {
    if (activationUrl) {
      await navigator.clipboard.writeText(activationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  async function onInviteSubmit(values: InviteForm) {
    try {
      const response = await backofficeApi.inviteEmployee({
        email: values.email,
        employeeCode: values.employeeCode || undefined,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone || undefined,
        roleIds: values.roleIds,
        facilityIds: values.facilityIds || [],
        primaryFacilityId: values.primaryFacilityId || null,
      });

      pushToast(`Invitación creada para ${response.employee.user.email}`);
      setActivation(response.activation);
      form.reset();
      setShowInvite(false);
      await refetch();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Error al invitar empleado");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 m-0">Empleados</h1>
          <p className="text-gray-500 mt-1">Gestión del equipo, roles y sucursales.</p>
        </div>
        <Button onClick={() => setShowInvite(true)}>
          <Plus className="w-4 h-4" />
          Invitar Empleado
        </Button>
      </div>

      <Card className="p-4 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <FormField label="Buscar">
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Nombre, correo, código..." />
          </FormField>
        </div>
        <div className="w-[200px]">
          <FormField label="Estado">
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Todos</option>
              {Object.entries(STATUS_LABEL).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </Select>
          </FormField>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <LoadingState label="Cargando empleados..." />
        ) : error ? (
          <div className="p-8 text-center text-red-600">Error al cargar empleados</div>
        ) : !employeesData?.items.length ? (
          <div className="p-8 text-center text-gray-500">No se encontraron empleados.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table
                columns={["Código", "Nombre", "Correo", "Estado", "Roles", "Acción"]}
                rows={employeesData.items.map((emp: Employee) => [
                  <span key={`code-${emp.id}`} className="font-mono text-sm">{emp.employeeCode || "—"}</span>,
                  <div key={`name-${emp.id}`} className="font-medium text-gray-900">
                    {emp.firstName} {emp.lastName}
                  </div>,
                  <div key={`email-${emp.id}`} className="text-gray-500">{emp.user.email}</div>,
                  <Badge key={`st-${emp.id}`} tone={STATUS_TONE[emp.status] || "neutral"}>
                    {STATUS_LABEL[emp.status] || emp.status}
                  </Badge>,
                  <div key={`roles-${emp.id}`} className="flex flex-wrap gap-1">
                    {emp.roles.length > 0 ? (
                      emp.roles.map(r => (
                        <span key={r.id} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                          {r.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 italic">Sin roles</span>
                    )}
                  </div>,
                  <Link key={`link-${emp.id}`} href={`/employees/${emp.id}`} className="text-primary hover:underline text-sm font-medium">
                    Ver perfil
                  </Link>,
                ])}
              />
            </div>
            {employeesData.pagination && (
              <div className="p-4 border-t">
                <Pagination
                  page={employeesData.pagination.page}
                  totalPages={employeesData.pagination.totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Invite Modal */}
      <Dialog
        open={showInvite}
        title="Invitar nuevo empleado"
        onClose={() => { setShowInvite(false); form.reset(); }}
        actions={
          <>
            <Button variant="ghost" onClick={() => { setShowInvite(false); form.reset(); }}>Cancelar</Button>
            <Button type="submit" form="invite-form" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Enviando..." : "Enviar invitación"}
            </Button>
          </>
        }
      >
        <form id="invite-form" onSubmit={form.handleSubmit(onInviteSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nombres" error={form.formState.errors.firstName?.message}>
              <Input {...form.register("firstName")} />
            </FormField>
            <FormField label="Apellidos" error={form.formState.errors.lastName?.message}>
              <Input {...form.register("lastName")} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Correo electrónico" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register("email")} />
            </FormField>
            <FormField label="Teléfono (opcional)" error={form.formState.errors.phone?.message}>
              <Input {...form.register("phone")} />
            </FormField>
          </div>

          <FormField label="Código de empleado (opcional)" error={form.formState.errors.employeeCode?.message}>
            <Input {...form.register("employeeCode")} />
          </FormField>

          <div className="border-t pt-4 mt-4">
            <h3 className="font-medium mb-3">Roles y Permisos</h3>
            {form.formState.errors.roleIds && (
              <p className="text-danger text-sm mb-2">{form.formState.errors.roleIds.message}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {rolesData?.items?.map(role => (
                <label key={role.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded border">
                  <input type="checkbox" value={role.id} {...form.register("roleIds")} className="w-4 h-4 rounded text-primary" />
                  <span className="font-medium text-gray-700">{role.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="font-medium mb-3">Sucursales (Facilities)</h3>
            <FormField label="Sucursal Principal" error={form.formState.errors.primaryFacilityId?.message}>
              <Select {...form.register("primaryFacilityId")}>
                <option value="">— Seleccionar —</option>
                {facilitiesData?.items?.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </Select>
            </FormField>
            <p className="text-sm text-gray-500 mt-3 mb-2">También opera en:</p>
            <div className="grid grid-cols-2 gap-2">
              {facilitiesData?.items?.map(f => (
                <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" value={f.id} {...form.register("facilityIds")} className="w-4 h-4 rounded" />
                  <span className="text-gray-700">{f.name}</span>
                </label>
              ))}
            </div>
          </div>
        </form>
      </Dialog>

      {/* Activation Modal */}
      <Dialog
        open={Boolean(activation)}
        title="¡Invitación creada con éxito!"
        onClose={() => setActivation(null)}
        actions={
          <Button onClick={() => setActivation(null)}>Entendido</Button>
        }
      >
        <div className="space-y-4">
          <Alert tone="success">
            Se ha generado un token de un solo uso para que el empleado establezca su contraseña.
          </Alert>
          <div className="bg-gray-50 p-4 rounded-lg border flex items-center justify-between gap-4">
            <code className="text-sm text-gray-800 break-all">{activationUrl}</code>
            <Button variant="secondary" onClick={handleCopy} className="shrink-0" type="button">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <p className="text-sm text-gray-500 italic">
            Atención: Una vez cierres esta ventana, no podrás recuperar este enlace. Deberás generar uno nuevo si se pierde.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
