import type { ReactNode } from "react";

import { FacilityFilterField } from "@/components/inventory/facility-filter-field";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

type FacilityFilterOption = {
  value: string;
  label: string;
};

type InventoryFiltersCardProps = {
  children: ReactNode;
  facilities: FacilityFilterOption[];
  facilityPlaceholder: string;
  facilityValue: string;
  onFacilityChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  searchValue: string;
};

export function InventoryFiltersCard({
  children,
  facilities,
  facilityPlaceholder,
  facilityValue,
  onFacilityChange,
  onSearchChange,
  searchValue,
}: InventoryFiltersCardProps) {
  return (
    <Card>
      <div className="filters-row">
        <FormField label="Buscar">
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </FormField>
        <FacilityFilterField
          facilities={facilities}
          onChange={(event) => onFacilityChange(event.target.value)}
          placeholder={facilityPlaceholder}
          value={facilityValue}
        />
        {children}
      </div>
    </Card>
  );
}
