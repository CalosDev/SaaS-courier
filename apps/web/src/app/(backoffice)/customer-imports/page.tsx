"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Table } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncState } from "@/hooks/use-async-state";
import { ApiError } from "@/lib/api/api-error";
import { backofficeApi } from "@/lib/api/backoffice";
import { parseTabularRows } from "@/lib/tabular-import";

export default function CustomerImportsPage() {
  const [rawText, setRawText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const jobs = useAsyncState(useCallback(() => backofficeApi.listCustomerImports(), []));
  const parsedRowsResult = useMemo(() => {
    try {
      return {
        rows: parseTabularRows(rawText),
        error: null,
      };
    } catch (cause) {
      return {
        rows: [],
        error: cause instanceof Error ? cause.message : "Formato invalido.",
      };
    }
  }, [rawText]);

  const parsedRows = parsedRowsResult.rows;
  const rowsError = parsedRowsResult.error;

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    setError(null);

    try {
      const job = await backofficeApi.createCustomerImport({
        name: String(formData.get("name") || "") || undefined,
        preserveCustomerCodes: formData.get("preserveCustomerCodes") === "on",
        rows: parsedRows,
      });
      setMessage("Trabajo de importacion creado.");
      setRawText("");
      await jobs.refresh();
      window.location.assign(`/customer-imports/${job.id}`);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "No fue posible crear la importacion.",
      );
    }
  }

  if (jobs.status === "loading") {
    return <LoadingState label="Cargando importaciones..." />;
  }

  if (jobs.status === "error") {
    return (
      <ErrorState
        title="No fue posible cargar importaciones"
        description={jobs.error.message}
        onRetry={() => void jobs.refresh()}
      />
    );
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h1>Importaciones de clientes</h1>
          <p>Pegado tabulado y validacion previa a commit.</p>
        </div>
      </section>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {rowsError ? <Alert tone="warning">{rowsError}</Alert> : null}

      <Card>
        <Table
          columns={["Nombre", "Estado", "Filas", "Importadas", "Accion"]}
          rows={jobs.data.map((job) => [
            job.name || "Sin nombre",
            job.status,
            job.totalRows,
            job.importedRows,
            <Link key={job.id} href={`/customer-imports/${job.id}`} className="inline-link">
              Ver detalle
            </Link>,
          ])}
        />
      </Card>

      <Card>
        <h2>Nuevo trabajo</h2>
        <form className="form-grid" onSubmit={handleCreate}>
          <FormField label="Nombre">
            <Input name="name" />
          </FormField>
          <label className="toggle-row">
            <input type="checkbox" name="preserveCustomerCodes" defaultChecked />
            <span>Preservar customerCode recibido</span>
          </label>
          <FormField
            label="Pegar datos tabulados"
            hint="La primera fila debe contener encabezados como type, firstName, lastName, businessName, email, phone, mobilePhone, customerCode, documentType y documentNumber."
          >
            <Textarea
              rows={10}
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
            />
          </FormField>
          <Button type="submit" disabled={parsedRows.length === 0 || Boolean(rowsError)}>
            Crear importacion
          </Button>
        </form>
      </Card>

      <Card>
        <h2>Vista previa</h2>
        <Table
          columns={["#", "Tipo", "Nombre", "Empresa", "Documento"]}
          rows={parsedRows.map((row, index) => [
            index + 1,
            row.type || "",
            `${row.firstName || ""} ${row.lastName || ""}`.trim(),
            row.businessName || "",
            row.customsProfile?.documentNumber || "",
          ])}
        />
      </Card>
    </div>
  );
}
