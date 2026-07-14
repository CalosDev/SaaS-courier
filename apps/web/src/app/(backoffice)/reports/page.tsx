"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import type { OperationalReport, ReportType } from "@/lib/api/contracts";
import { useAuth } from "@/lib/auth/auth-provider";

const REPORT_OPTIONS: Array<{ value: ReportType; label: string }> = [
  { value: "OPERATIONS", label: "Operaciones" },
  { value: "INVENTORY", label: "Inventario" },
  { value: "BILLING", label: "Facturacion" },
  { value: "SHIPMENTS", label: "Embarques" },
  { value: "CUSTOMS", label: "Aduanas" },
];

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function ReportsPage() {
  const router = useRouter();
  const { state } = useAuth();
  const [reportType, setReportType] = useState<ReportType>("OPERATIONS");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [report, setReport] = useState<OperationalReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canExport =
    state.status === "authenticated" &&
    state.permissionCodes.includes("reports.export");

  function filters() {
    return {
      dateFrom: dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined,
      dateTo: dateTo ? `${dateTo}T23:59:59.999Z` : undefined,
    };
  }

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      setReport(await backofficeApi.getOperationalReport(reportType, filters()));
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No fue posible cargar el reporte.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function requestExport() {
    setLoading(true);
    setError(null);
    try {
      const job = await backofficeApi.requestReportExport({
        reportType,
        ...filters(),
      });
      router.push(`/reports/exports?exportId=${job.id}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No fue posible solicitar la exportacion.",
      );
      setLoading(false);
    }
  }

  const scalarRows = report
    ? Object.entries(report.data)
        .filter(([, value]) => !Array.isArray(value))
        .map(([key, value]) => [key, displayValue(value)])
    : [];
  const collections = report
    ? Object.entries(report.data).filter(([, value]) => Array.isArray(value))
    : [];

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Reportes</h1>
          <p>Indicadores operativos del courier actual.</p>
        </div>
      </section>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        <div className="filters-row">
          <FormField label="Tipo de reporte">
            <Select
              value={reportType}
              onChange={(event) => setReportType(event.target.value as ReportType)}
            >
              {REPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Desde">
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </FormField>
          <FormField label="Hasta">
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </FormField>
          <Button onClick={() => void loadReport()} disabled={loading}>
            Consultar
          </Button>
          {canExport ? (
            <Button
              variant="secondary"
              onClick={() => void requestExport()}
              disabled={loading}
            >
              Exportar CSV
            </Button>
          ) : null}
        </div>
      </Card>

      {report ? (
        <>
          {scalarRows.length ? (
            <Card>
              <Table columns={["Indicador", "Valor"]} rows={scalarRows} />
            </Card>
          ) : null}
          {collections.map(([name, value]) => {
            const items = value as Array<Record<string, unknown>>;
            const columns = items[0] ? Object.keys(items[0]) : [];
            return (
              <Card key={name}>
                <h2>{name}</h2>
                {items.length ? (
                  <Table
                    columns={columns}
                    rows={items.map((item) =>
                      columns.map((column) => displayValue(item[column])),
                    )}
                  />
                ) : (
                  <p>Sin datos para el periodo seleccionado.</p>
                )}
              </Card>
            );
          })}
        </>
      ) : null}
    </div>
  );
}
