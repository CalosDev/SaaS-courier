export class OrganizationProvisioningError extends Error {
  readonly code: string = 'ORGANIZATION_PROVISIONING_FAILED';
}

export class OrganizationProvisioningConflictError extends OrganizationProvisioningError {
  readonly code = 'ORGANIZATION_PROVISIONING_CONFLICT';
}
