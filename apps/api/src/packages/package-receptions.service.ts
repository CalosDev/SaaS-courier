import { Inject, Injectable } from '@nestjs/common';

import type { CommandContext } from '../request-context/request-context.types';
import { InvalidPackageInputError } from './package.errors';
import { PackageReceptionNotFoundError } from './package-reception.errors';
import {
  PACKAGE_CONDITION_VALUES,
  type PackageCondition,
  type PackageReceptionRecord,
  type ReceivePackageInput,
} from './package-reception.types';
import { PackageReceptionsRepository } from './package-receptions.repository';

const MAX_WEIGHT = 100_000;
const MAX_DIMENSION = 10_000;
const MAX_PIECE_COUNT = 10_000;

@Injectable()
export class PackageReceptionsService {
  constructor(
    @Inject(PackageReceptionsRepository)
    private readonly repository: PackageReceptionsRepository,
  ) {}

  async receive(
    organizationId: string,
    packageId: string,
    input: ReceivePackageInput,
    context?: CommandContext,
  ): Promise<PackageReceptionRecord> {
    const normalizedOrganizationId = this.requiredText(
      organizationId,
      'organizationId',
    );
    const commandContext = this.commandContext(
      context,
      normalizedOrganizationId,
    );

    return this.repository.receive(
      {
        organizationId: normalizedOrganizationId,
        packageId: this.requiredText(packageId, 'packageId'),
        facilityId: this.requiredText(input.facilityId, 'facilityId'),
        receivedByEmployeeId: this.requiredText(
          context?.actorEmployeeId,
          'actorEmployeeId',
        ),
        weight: this.measurement(input.weight, 'weight', 3, MAX_WEIGHT),
        length: this.measurement(input.length, 'length', 2, MAX_DIMENSION),
        width: this.measurement(input.width, 'width', 2, MAX_DIMENSION),
        height: this.measurement(input.height, 'height', 2, MAX_DIMENSION),
        pieceCount: this.pieceCount(input.pieceCount),
        condition: this.condition(input.condition),
      },
      commandContext,
    );
  }

  async get(
    organizationId: string,
    packageId: string,
  ): Promise<PackageReceptionRecord> {
    const normalizedPackageId = this.requiredText(packageId, 'packageId');
    const reception = await this.repository.findByPackageId(
      this.requiredText(organizationId, 'organizationId'),
      normalizedPackageId,
    );

    if (!reception) {
      throw new PackageReceptionNotFoundError(normalizedPackageId);
    }

    return reception;
  }

  private requiredText(
    value: string | null | undefined,
    field: string,
  ): string {
    const normalized = typeof value === 'string' ? value.trim() : '';

    if (!normalized) {
      throw new InvalidPackageInputError(
        `Invalid package input: ${field} is required`,
      );
    }

    return normalized;
  }

  private measurement(
    value: number,
    field: string,
    scale: number,
    maximum: number,
  ): string {
    if (!Number.isFinite(value) || value <= 0 || value > maximum) {
      throw new InvalidPackageInputError(
        `Invalid package input: ${field} is out of range`,
      );
    }

    return value.toFixed(scale);
  }

  private pieceCount(value: number): number {
    if (!Number.isInteger(value) || value < 1 || value > MAX_PIECE_COUNT) {
      throw new InvalidPackageInputError(
        'Invalid package input: pieceCount is out of range',
      );
    }

    return value;
  }

  private condition(value: PackageCondition): PackageCondition {
    if (!(PACKAGE_CONDITION_VALUES as readonly string[]).includes(value)) {
      throw new InvalidPackageInputError(
        'Invalid package input: condition is invalid',
      );
    }

    return value;
  }

  private commandContext(
    context: CommandContext | undefined,
    organizationId: string,
  ): CommandContext {
    this.requiredText(context?.actorEmployeeId, 'actorEmployeeId');

    if (context?.organizationId !== organizationId) {
      throw new InvalidPackageInputError(
        'Invalid package input: command context organization mismatch',
      );
    }

    return context;
  }
}
