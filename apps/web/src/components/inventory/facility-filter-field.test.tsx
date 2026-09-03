import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FacilityFilterField } from "@/components/inventory/facility-filter-field";

describe("FacilityFilterField", () => {
  it("renders facility options and forwards select changes", () => {
    const onChange = vi.fn();

    render(
      <FacilityFilterField
        facilities={[{ value: "facility-1", label: "MIA-01 · Miami Origin" }]}
        onChange={onChange}
        placeholder="Todos"
        value=""
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Facility" }), {
      target: { value: "facility-1" },
    });

    expect(screen.getByRole("option", { name: "Todos" })).toHaveValue("");
    expect(
      screen.getByRole("option", { name: "MIA-01 · Miami Origin" }),
    ).toHaveValue("facility-1");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
