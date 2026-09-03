import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InventoryFiltersCard } from "@/components/inventory/inventory-filters-card";

describe("InventoryFiltersCard", () => {
  it("renders search, facility filter and custom filters", () => {
    const onFacilityChange = vi.fn();
    const onSearchChange = vi.fn();

    render(
      <InventoryFiltersCard
        facilities={[{ value: "facility-1", label: "MIA-01 · Miami Origin" }]}
        facilityPlaceholder="Todas"
        facilityValue=""
        onFacilityChange={onFacilityChange}
        onSearchChange={onSearchChange}
        searchValue=""
      >
        <div>Filtro adicional</div>
      </InventoryFiltersCard>,
    );

    fireEvent.change(screen.getByLabelText("Buscar"), {
      target: { value: "PKG-1" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Facility" }), {
      target: { value: "facility-1" },
    });

    expect(screen.getByText("Filtro adicional")).toBeVisible();
    expect(onSearchChange).toHaveBeenCalledWith("PKG-1");
    expect(onFacilityChange).toHaveBeenCalledWith("facility-1");
  });
});
