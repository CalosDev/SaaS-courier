"use client";

import {
  CustomerSelector as SharedCustomerSelector,
  type CustomerSelectorProps,
} from "@/components/customers/customer-selector";

export function CustomerSelector(props: CustomerSelectorProps) {
  return (
    <SharedCustomerSelector
      {...props}
      loadErrorMessage="No fue posible cargar clientes para la prealerta."
      unavailableCustomersMessage="cliente(s) del resultado no estan disponibles para nuevas prealertas."
    />
  );
}
