import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { OrganizationProvisioningService } from '../src/provisioning/organization-provisioning.service';
import type { ProvisionOrganizationInput } from '../src/provisioning/organization-provisioning.types';

interface Arguments {
  inputPath: string;
  confirmedSlug: string;
}

async function main(): Promise<void> {
  if (process.env.ALLOW_ORGANIZATION_PROVISIONING !== 'true') {
    throw new Error(
      'Set ALLOW_ORGANIZATION_PROVISIONING=true for this command only',
    );
  }

  const args = parseArguments(process.argv.slice(2));
  const input = parseInput(args.inputPath);
  const inputSlug = input.organization?.slug?.trim().toLowerCase();
  if (!inputSlug || args.confirmedSlug !== inputSlug) {
    throw new Error('--confirm must exactly match organization.slug');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const provisioning = app.get(OrganizationProvisioningService);
    const result = await provisioning.provision(input);
    process.stdout.write(
      `${JSON.stringify(
        {
          ...result,
          activationExpiresAt: result.activationExpiresAt.toISOString(),
          warning:
            'The activation token is shown once. Deliver it through an approved secure channel.',
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await app.close();
  }
}

function parseArguments(values: string[]): Arguments {
  const inputIndex = values.indexOf('--input');
  const confirmIndex = values.indexOf('--confirm');
  const inputPath = inputIndex >= 0 ? values[inputIndex + 1] : undefined;
  const confirmedSlug =
    confirmIndex >= 0
      ? values[confirmIndex + 1]?.trim().toLowerCase()
      : undefined;

  if (!inputPath || !confirmedSlug) {
    throw new Error(
      'Usage: provision:organization -- --input <json-file> --confirm <slug>',
    );
  }
  return { inputPath, confirmedSlug };
}

function parseInput(inputPath: string): ProvisionOrganizationInput {
  const absolutePath = resolve(process.cwd(), inputPath);
  const parsed: unknown = JSON.parse(readFileSync(absolutePath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Provisioning input must be a JSON object');
  }
  return parsed as ProvisionOrganizationInput;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  process.stderr.write(`Organization provisioning failed: ${message}\n`);
  process.exitCode = 1;
});
