import type { CommandContext } from '../request-context/request-context.types';
import type {
  PackageReceptionRecord,
  ReceivePackageRecord,
} from './package-reception.types';

export abstract class PackageReceptionsRepository {
  abstract receive(
    input: ReceivePackageRecord,
    context: CommandContext,
  ): Promise<PackageReceptionRecord>;

  abstract findByPackageId(
    organizationId: string,
    packageId: string,
  ): Promise<PackageReceptionRecord | null>;
}
