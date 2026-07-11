import { DispatchStatus } from '../generated/prisma/client';

export const DISPATCH_STATUS_VALUES = [
  DispatchStatus.DRAFT,
  DispatchStatus.CLOSED,
  DispatchStatus.DEPARTED,
  DispatchStatus.ARRIVED,
  DispatchStatus.COMPLETED,
  DispatchStatus.CANCELLED,
] as const;

export type DispatchStatusType = (typeof DISPATCH_STATUS_VALUES)[number];

export interface DispatchRecord {
  id: string;
  organizationId: string;
  dispatchCode: string;
  status: DispatchStatusType;
  origin: string | null;
  destination: string | null;
  carrier: string | null;
  flightNumber: string | null;
  departureTime: Date | null;
  estimatedArrivalTime: Date | null;
  actualArrivalTime: Date | null;
  mawb: string | null;
  createdAt: Date;
  updatedAt: Date;
}
