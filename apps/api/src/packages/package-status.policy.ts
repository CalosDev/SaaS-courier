import { PackageStatus, TrackingEventType } from '../generated/prisma/client';
import { InvalidPackageStatusTransitionError } from './package.errors';

const PACKAGE_STATUS_TRANSITIONS: Readonly<
  Record<PackageStatus, readonly PackageStatus[]>
> = {
  [PackageStatus.RECEPTION_PENDING]: [
    PackageStatus.RECEIVED_AT_ORIGIN,
    PackageStatus.CANCELLED,
  ],
  [PackageStatus.RECEIVED_AT_ORIGIN]: [PackageStatus.IN_TRANSIT],
  [PackageStatus.IN_TRANSIT]: [PackageStatus.ARRIVED_AT_DESTINATION],
  [PackageStatus.ARRIVED_AT_DESTINATION]: [
    PackageStatus.IN_TRANSIT,
    PackageStatus.OUT_FOR_DELIVERY,
  ],
  [PackageStatus.OUT_FOR_DELIVERY]: [
    PackageStatus.DELIVERED,
    PackageStatus.ARRIVED_AT_DESTINATION,
  ],
  [PackageStatus.DELIVERED]: [],
  [PackageStatus.CANCELLED]: [],
};

const TRACKING_EVENT_STATUS: Partial<Record<TrackingEventType, PackageStatus>> =
  {
    [TrackingEventType.RECEIVED_AT_ORIGIN]: PackageStatus.RECEIVED_AT_ORIGIN,
    [TrackingEventType.IN_TRANSIT]: PackageStatus.IN_TRANSIT,
    [TrackingEventType.ARRIVED_AT_DESTINATION]:
      PackageStatus.ARRIVED_AT_DESTINATION,
    [TrackingEventType.OUT_FOR_DELIVERY]: PackageStatus.OUT_FOR_DELIVERY,
    [TrackingEventType.DELIVERED]: PackageStatus.DELIVERED,
  };

export function assertPackageStatusTransition(
  currentStatus: PackageStatus,
  targetStatus: PackageStatus,
): void {
  if (PACKAGE_STATUS_TRANSITIONS[currentStatus].includes(targetStatus)) {
    return;
  }

  throw new InvalidPackageStatusTransitionError(
    `Package cannot transition from ${currentStatus} to ${targetStatus}`,
  );
}

export function assertTrackingEventMatchesPackageStatus(
  currentStatus: PackageStatus,
  eventType: TrackingEventType,
): void {
  if (currentStatus === PackageStatus.CANCELLED) {
    throw new InvalidPackageStatusTransitionError(
      'Tracking events cannot be added to a cancelled package',
    );
  }

  if (eventType === TrackingEventType.EXCEPTION) {
    return;
  }

  const representedStatus = TRACKING_EVENT_STATUS[eventType];
  if (representedStatus !== currentStatus) {
    throw new InvalidPackageStatusTransitionError(
      `Tracking event ${eventType} does not match package status ${currentStatus}; the operational workflow must transition the package first`,
    );
  }
}
