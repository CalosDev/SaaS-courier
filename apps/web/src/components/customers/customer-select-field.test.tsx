import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CustomerSelectField } from "@/components/customers/customer-select-field";
import type { Customer } from "@/lib/api/contracts";

describe("CustomerSelectField", () => {
  it("renders its error, placeholder and customer labels", () => {
    const customer = {
      id: "customer-1",
      customerCode: "C001",
      displayName: "Ana Perez",
    } as Customer;

    render(
      <CustomerSelectField
        customers={[customer]}
        error="Cliente requerido"
        placeholder="Selecciona un cliente"
        name="customerId"
      />,
    );

    expect(screen.getByRole("combobox")).toHaveAttribute("name", "customerId");
    expect(screen.getByText("Cliente requerido")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "C001 · Ana Perez" })).toHaveValue(
      "customer-1",
    );
  });
});
