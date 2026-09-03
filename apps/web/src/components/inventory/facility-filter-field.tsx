import type { SelectHTMLAttributes } from "react";

import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";

type FacilityFilterOption = {
  value: string;
  label: string;
};

type FacilityFilterFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  facilities: FacilityFilterOption[];
  placeholder: string;
};

export function FacilityFilterField({
  facilities,
  placeholder,
  ...selectProps
}: FacilityFilterFieldProps) {
  return (
    <FormField label="Facility">
      <Select {...selectProps}>
        <option value="">{placeholder}</option>
        {facilities.map((facility) => (
          <option key={facility.value} value={facility.value}>
            {facility.label}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
