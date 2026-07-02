import { describe, expect, it } from "vitest";

import { parseTabularRows } from "@/lib/tabular-import";

describe("parseTabularRows", () => {
  it("normalizes aliases and builds customsProfile data", () => {
    const rows = parseTabularRows(
      [
        "tipo\tnombres\tapellidos\tdocument_type\tdocumento",
        "individual\tAda\tLovelace\tcedula\t00112345678",
      ].join("\n"),
    );

    expect(rows).toEqual([
      {
        type: "INDIVIDUAL",
        firstName: "Ada",
        lastName: "Lovelace",
        customsProfile: {
          documentType: "CEDULA",
          documentNumber: "00112345678",
        },
      },
    ]);
  });

  it("rejects payloads above the 250-row limit", () => {
    const body = ["type\tfirstName"];

    for (let index = 0; index < 251; index += 1) {
      body.push(`INDIVIDUAL\tCliente ${index + 1}`);
    }

    expect(() => parseTabularRows(body.join("\n"))).toThrow(/250 filas/);
  });
});
