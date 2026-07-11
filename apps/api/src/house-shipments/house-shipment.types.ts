import type { Prisma } from '../generated/prisma/client';

export type HouseShipmentRecord = Prisma.HouseShipmentGetPayload<{
  include: {
    packages: {
      include: {
        package: true;
      };
    };
  };
}>;
