const FIELD_ALIASES: Record<string, string> = {
  tipo: "type",
  type: "type",
  nombres: "firstName",
  first_name: "firstName",
  firstname: "firstName",
  firstName: "firstName",
  apellidos: "lastName",
  last_name: "lastName",
  lastname: "lastName",
  lastName: "lastName",
  empresa: "businessName",
  business_name: "businessName",
  businessName: "businessName",
  email: "email",
  telefono: "phone",
  phone: "phone",
  celular: "mobilePhone",
  mobile: "mobilePhone",
  mobilephone: "mobilePhone",
  mobilePhone: "mobilePhone",
  notas: "notes",
  notes: "notes",
  codigo: "customerCode",
  customer_code: "customerCode",
  customerCode: "customerCode",
  documento: "documentNumber",
  document_number: "documentNumber",
  documentNumber: "documentNumber",
  document_type: "documentType",
  documentType: "documentType",
};

export type ImportDraftRow = {
  type?: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  notes?: string;
  customerCode?: string;
  customsProfile?: {
    documentType?: string;
    documentNumber?: string;
  };
};

export function parseTabularRows(text: string): ImportDraftRow[] {
  const normalized = text.trim();

  if (!normalized) {
    return [];
  }

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  if (lines.length > 251) {
    throw new Error("Se permiten como máximo 250 filas por importación.");
  }

  const rows = lines.map((line) => line.split("\t").map((cell) => cell.trim()));
  const headers = rows[0].map((value) => FIELD_ALIASES[value] || value);
  const dataRows = rows.slice(1);

  return dataRows.map((cells) => {
    const row: ImportDraftRow = {};
    const customsProfile: ImportDraftRow["customsProfile"] = {};

    headers.forEach((header, index) => {
      const value = cells[index];

      if (!value) {
        return;
      }

      if (header === "documentType") {
        customsProfile.documentType = value.toUpperCase();
        return;
      }

      if (header === "documentNumber") {
        customsProfile.documentNumber = value;
        return;
      }

      (row as Record<string, unknown>)[header] = value;
    });

    if (customsProfile.documentType || customsProfile.documentNumber) {
      row.customsProfile = customsProfile;
    }

    if (row.type) {
      row.type = row.type.toUpperCase();
    }

    return row;
  });
}
