"use client";

import { useCallback, useState } from "react";
import { PlugZap, Power, TestTube2 } from "lucide-react";

import { PermissionBoundary } from "@/components/auth/permission-boundary";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { useAsyncState } from "@/hooks/use-async-state";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";

export default function CarrierConnectionsPage() {
  const resource = useAsyncState(useCallback(() => backofficeApi.listCarrierConnections(), []));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(null);
    try {
      await backofficeApi.createCarrierConnection({ carrierCode: data.get("carrierCode"), displayName: data.get("displayName"), secretReference: data.get("secretReference"), status: "DISABLED" });
      form.reset();
      setMessage("Conexión creada. Configura el secreto en el entorno antes de activarla.");
      await resource.refresh();
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "No fue posible crear la conexión."); }
  }
  async function test(id: string) {
    setError(null);
    try { const response = await backofficeApi.testCarrierConnection(id); setMessage(response.test?.success ? "Conexión validada." : `Prueba fallida: ${response.test?.errorCode || "ERROR"}`); await resource.refresh(); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "No fue posible probar la conexión."); }
  }
  async function toggle(id: string, active: boolean) {
    setError(null);
    try { await backofficeApi.updateCarrierConnection(id, { status: active ? "DISABLED" : "ACTIVE" }); await resource.refresh(); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "No fue posible actualizar la conexión."); }
  }
  if (resource.status === "loading") return <LoadingState label="Cargando carriers..." />;
  if (resource.status === "error") return <ErrorState title="No fue posible cargar carriers" description={resource.error.message} onRetry={() => void resource.refresh()} />;
  return (
    <PermissionBoundary requiredPermissions={["carriers.read"]}>
      <div className="page-stack">
        <section className="page-header"><div><h1>Integraciones carrier</h1><p>Conectores autorizados con secretos externos y webhooks firmados.</p></div></section>
        {message ? <Alert tone="info">{message}</Alert> : null}{error ? <Alert tone="error">{error}</Alert> : null}
        <PermissionBoundary requiredPermissions={["carriers.manage"]}>
          <Card><h2>Nueva conexión</h2><form className="form-grid" onSubmit={(event) => void create(event)}><FormField label="Carrier"><Select name="carrierCode" required defaultValue=""><option value="">Selecciona</option><option value="UPS">UPS</option><option value="FEDEX">FedEx</option><option value="DHL">DHL</option></Select></FormField><FormField label="Nombre"><Input name="displayName" maxLength={120} required /></FormField><FormField label="Referencia del secreto"><Input name="secretReference" pattern="[A-Z][A-Z0-9_]+" placeholder="UPS_PILOT" required /></FormField><Button type="submit"><PlugZap className="button-icon" /><span>Crear conexión</span></Button></form></Card>
        </PermissionBoundary>
        <Card><Table columns={["Carrier", "Nombre", "Credencial", "Estado", "Última prueba", "Acciones"]} rows={resource.data.map((connection) => [connection.carrierCode, connection.displayName, connection.credentialConfigured ? "Configurada" : "Pendiente", <Badge key={`${connection.id}-status`} tone={connection.status === "ACTIVE" ? "success" : connection.status === "ERROR" ? "danger" : "neutral"}>{connection.status}</Badge>, connection.lastTestedAt?.slice(0,16).replace("T"," ") || "Nunca", <PermissionBoundary key={connection.id} requiredPermissions={["carriers.manage"]}><div className="button-row"><Button variant="secondary" onClick={() => void test(connection.id)}><TestTube2 className="button-icon" /><span>Probar</span></Button><Button variant="secondary" onClick={() => void toggle(connection.id, connection.status === "ACTIVE")}><Power className="button-icon" /><span>{connection.status === "ACTIVE" ? "Desactivar" : "Activar"}</span></Button></div></PermissionBoundary>])} /></Card>
      </div>
    </PermissionBoundary>
  );
}
