import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CarrierSecretProvider {
  constructor(private readonly config: ConfigService) {}

  getSecret(reference: string): string | null {
    if (!/^[A-Z][A-Z0-9_]{2,119}$/.test(reference)) return null;
    const value = this.config
      .get<string>(`CARRIER_SECRET_${reference}`)
      ?.trim();
    return value || null;
  }

  getBaseUrl(carrierCode: string): string | null {
    const value = this.config
      .get<string>(`CARRIER_${carrierCode}_BASE_URL`)
      ?.trim()
      .replace(/\/$/, '');
    return value || null;
  }
}
