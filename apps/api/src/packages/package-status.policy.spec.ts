import { PackageStatus, TrackingEventType } from '../generated/prisma/client';
import { InvalidPackageStatusTransitionError } from './package.errors';
import {
  assertPackageStatusTransition,
  assertTrackingEventMatchesPackageStatus,
} from './package-status.policy';

describe('package status policy', () => {
  it.each([
    [PackageStatus.RECEPTION_PENDING, PackageStatus.RECEIVED_AT_ORIGIN],
    [PackageStatus.RECEPTION_PENDING, PackageStatus.CANCELLED],
    [PackageStatus.RECEIVED_AT_ORIGIN, PackageStatus.IN_TRANSIT],
    [PackageStatus.IN_TRANSIT, PackageStatus.ARRIVED_AT_DESTINATION],
    [PackageStatus.ARRIVED_AT_DESTINATION, PackageStatus.IN_TRANSIT],
    [PackageStatus.ARRIVED_AT_DESTINATION, PackageStatus.OUT_FOR_DELIVERY],
    [PackageStatus.OUT_FOR_DELIVERY, PackageStatus.DELIVERED],
    [PackageStatus.OUT_FOR_DELIVERY, PackageStatus.ARRIVED_AT_DESTINATION],
  ])('accepts the operational transition %s -> %s', (current, target) => {
    expect(() => assertPackageStatusTransition(current, target)).not.toThrow();
  });

  it.each([
    [PackageStatus.RECEPTION_PENDING, PackageStatus.DELIVERED],
    [PackageStatus.RECEIVED_AT_ORIGIN, PackageStatus.OUT_FOR_DELIVERY],
    [PackageStatus.IN_TRANSIT, PackageStatus.DELIVERED],
    [PackageStatus.DELIVERED, PackageStatus.IN_TRANSIT],
    [PackageStatus.CANCELLED, PackageStatus.RECEIVED_AT_ORIGIN],
  ])('rejects the invalid transition %s -> %s', (current, target) => {
    expect(() => assertPackageStatusTransition(current, target)).toThrow(
      InvalidPackageStatusTransitionError,
    );
  });

  it('accepts a tracking event that reflects the current operational status', () => {
    expect(() =>
      assertTrackingEventMatchesPackageStatus(
        PackageStatus.IN_TRANSIT,
        TrackingEventType.IN_TRANSIT,
      ),
    ).not.toThrow();
  });

  it('allows an exception without changing operational status', () => {
    expect(() =>
      assertTrackingEventMatchesPackageStatus(
        PackageStatus.RECEIVED_AT_ORIGIN,
        TrackingEventType.EXCEPTION,
      ),
    ).not.toThrow();
  });

  it('rejects tracking events that attempt to advance the package', () => {
    expect(() =>
      assertTrackingEventMatchesPackageStatus(
        PackageStatus.IN_TRANSIT,
        TrackingEventType.DELIVERED,
      ),
    ).toThrow(InvalidPackageStatusTransitionError);
  });

  it('rejects every tracking event after cancellation', () => {
    expect(() =>
      assertTrackingEventMatchesPackageStatus(
        PackageStatus.CANCELLED,
        TrackingEventType.EXCEPTION,
      ),
    ).toThrow(InvalidPackageStatusTransitionError);
  });
});
