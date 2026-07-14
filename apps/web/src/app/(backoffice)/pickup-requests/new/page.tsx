"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { backofficeApi } from "@/lib/api/backoffice";
import { ApiError } from "@/lib/api/api-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

export default function NewPickupRequestPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [customerId, setCustomerId] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [packageIds, setPackageIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { data: customers } = useSWR("/pickup-customers", () => backofficeApi.listCustomers({ page: 1, pageSize: 100, status: "ACTIVE" }));
  const { data: facilities } = useSWR("/pickup-facilities", () => backofficeApi.listFacilities({ page: 1, pageSize: 100, isActive: true }));
  const { data: packages } = useSWR("/pickup-packages", () => backofficeApi.listPackages({ page: 1, pageSize: 100, status: "ARRIVED_AT_DESTINATION" }));
  const eligiblePackages = useMemo(() => (packages?.items ?? []).filter((item) => item.customer.id === customerId), [packages, customerId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!customerId || !facilityId || packageIds.length === 0) return;
    setSubmitting(true);
    try {
      const created = await backofficeApi.createPickupRequest({ customerId, facilityId, packageIds });
      router.push(`/pickup-requests/${created.id}`);
    } catch (error) {
      pushToast(error instanceof ApiError ? error.message : "No fue posible crear la solicitud.");
      setSubmitting(false);
    }
  }

  return <div className="page-stack"><section className="page-header"><div><h1>Nueva solicitud de retiro</h1><p>Selecciona un cliente, sucursal y sus paquetes elegibles.</p></div></section>
    <Card><form className="form-grid" onSubmit={submit}>
      <FormField label="Cliente"><Select aria-label="Cliente" value={customerId} onChange={(event) => { setCustomerId(event.target.value); setPackageIds([]); }}><option value="">Selecciona un cliente</option>{(customers?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.customerCode} · {item.displayName}</option>)}</Select></FormField>
      <FormField label="Sucursal"><Select aria-label="Sucursal" value={facilityId} onChange={(event) => setFacilityId(event.target.value)}><option value="">Selecciona una sucursal</option>{(facilities?.items ?? []).filter((item) => item.isCustomerFacing).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</Select></FormField>
      <fieldset><legend>Paquetes</legend>{eligiblePackages.map((item) => <label key={item.id} className="flex items-center gap-2 py-2"><input type="checkbox" checked={packageIds.includes(item.id)} onChange={(event) => setPackageIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />{item.internalTrackingNumber}</label>)}{customerId && eligiblePackages.length === 0 ? <p>No hay paquetes elegibles para este cliente.</p> : null}</fieldset>
      <div><Button type="submit" disabled={submitting || !customerId || !facilityId || packageIds.length === 0}>{submitting ? "Creando..." : "Crear solicitud"}</Button></div>
    </form></Card></div>;
}
