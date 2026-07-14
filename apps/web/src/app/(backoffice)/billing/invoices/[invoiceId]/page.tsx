"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = use(params);
  const { pushToast } = useToast();
  const [voidReason, setVoidReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    data: invoice,
    error,
    isLoading,
    mutate,
  } = useSWR(`/invoices/${invoiceId}`, () =>
    backofficeApi.getInvoice(invoiceId),
  );

  async function issue() {
    setIsSubmitting(true);
    try {
      const updated = await backofficeApi.issueInvoice(invoiceId);
      await mutate(updated, { revalidate: false });
      pushToast("Factura emitida.");
    } catch (caught) {
      pushToast(
        caught instanceof ApiError ? caught.message : "No fue posible emitir.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function voidInvoice() {
    if (!voidReason.trim()) return;
    setIsSubmitting(true);
    try {
      const updated = await backofficeApi.voidInvoice(invoiceId, {
        reason: voidReason.trim(),
      });
      await mutate(updated, { revalidate: false });
      pushToast("Factura anulada.");
    } catch (caught) {
      pushToast(
        caught instanceof ApiError ? caught.message : "No fue posible anular.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <div className="ui-state">Cargando factura...</div>;
  if (error || !invoice)
    return <div className="ui-state">Error al cargar la factura.</div>;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/billing/invoices" aria-label="Volver">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1>Factura {invoice.invoiceNumber}</h1>
            <Badge tone={invoice.status === "VOID" ? "danger" : "neutral"}>
              {invoice.status}
            </Badge>
          </div>
          <p>
            Balance: {invoice.currencyCode}{" "}
            {(Number(invoice.balanceDueMinor) / 100).toFixed(2)}
          </p>
        </div>
        {invoice.status === "DRAFT" ? (
          <Button onClick={() => void issue()} disabled={isSubmitting}>
            Emitir factura
          </Button>
        ) : null}
      </div>

      <Card>
        <h2>Líneas</h2>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.description}</td>
                  <td>{line.quantity}</td>
                  <td>
                    {invoice.currencyCode}{" "}
                    {(Number(line.totalPriceMinor) / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID" ? (
        <Card>
          <h2>Anular factura</h2>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <FormField label="Motivo">
                <Input
                  value={voidReason}
                  onChange={(event) => setVoidReason(event.target.value)}
                  maxLength={500}
                />
              </FormField>
            </div>
            <Button
              variant="danger"
              onClick={() => void voidInvoice()}
              disabled={isSubmitting || !voidReason.trim()}
            >
              Anular
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
