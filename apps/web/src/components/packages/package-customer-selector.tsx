"use client";

import {
  CustomerSelector,
  type CustomerSelectorProps,
} from "@/components/customers/customer-selector";

export function PackageCustomerSelector(props: CustomerSelectorProps) {
  return (
    <CustomerSelector
      {...props}
      loadErrorMessage="No fue posible cargar clientes para el paquete."
      unavailableCustomersMessage="cliente(s) del resultado no estan disponibles para registrar paquetes."
    />
  );
}
