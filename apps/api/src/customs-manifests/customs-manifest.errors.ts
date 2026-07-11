export const CustomsManifestErrors = {
  NotFound: {
    code: 'customs_manifest.not_found',
    message: 'Customs manifest not found',
  },
  InvalidStatus: {
    code: 'customs_manifest.invalid_status',
    message: 'Invalid status transition for customs manifest',
  },
  PackagesNotFound: {
    code: 'customs_manifest.packages_not_found',
    message:
      'One or more packages not found or not in a valid state to be added',
  },
} as const;
