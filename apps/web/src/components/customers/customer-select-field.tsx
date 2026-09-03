import type { SelectHTMLAttributes } from "react";

import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import type { Customer } from "@/lib/api/contracts";

type CustomerSelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  customers: Customer[];
  error?: string;
  placeholder: string;
};

export function CustomerSelectField({
  customers,
  error,
  placeholder,
  ...selectProps
}: CustomerSelectFieldProps) {
  return (
    <FormField label="Cliente" error={error}>
      <Select {...selectProps}>
        <option value="">{placeholder}</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.customerCode} · {customer.displayName}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
