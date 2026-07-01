import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentSession } from '../auth/http/current-session.decorator';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import { CustomerAddressesService } from './customer-addresses.service';
import { CustomerCustomsProfilesService } from './customer-customs-profiles.service';
import { CustomersService } from './customers.service';
import { CreateCustomerAddressDto } from './dto/create-customer-address.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerAddressDto } from './dto/update-customer-address.dto';
import { UpdateCustomerCustomsVerificationDto } from './dto/update-customer-customs-verification.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpsertCustomerCustomsProfileDto } from './dto/upsert-customer-customs-profile.dto';
import type {
  CustomerAddressRecord,
  CustomerCustomsProfileRecord,
  CustomerListResult,
  CustomerRecord,
} from './customer.types';

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly customerAddressesService: CustomerAddressesService,
    private readonly customerCustomsProfilesService: CustomerCustomsProfilesService,
  ) {}

  @Get()
  @RequirePermissions('customers.read')
  async listCustomers(
    @CurrentSession() session: SessionContext,
    @Query() query: ListCustomersDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const result = await this.customersService.list(
      session.organizationId,
      query,
    );

    return this.serializeCustomerList(result);
  }

  @Post()
  @RequirePermissions('customers.manage')
  @HttpCode(201)
  async createCustomer(
    @CurrentSession() session: SessionContext,
    @Body() body: CreateCustomerDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const customer = await this.customersService.create(
      session.organizationId,
      body,
    );

    return this.serializeCustomer(customer);
  }

  @Get(':customerId')
  @RequirePermissions('customers.read')
  async getCustomer(
    @CurrentSession() session: SessionContext,
    @Param('customerId', new ParseUUIDPipe({ version: '4' }))
    customerId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const customer = await this.customersService.getById(
      session.organizationId,
      customerId,
    );

    return this.serializeCustomer(customer);
  }

  @Patch(':customerId')
  @RequirePermissions('customers.manage')
  async updateCustomer(
    @CurrentSession() session: SessionContext,
    @Param('customerId', new ParseUUIDPipe({ version: '4' }))
    customerId: string,
    @Body() body: UpdateCustomerDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const customer = await this.customersService.update(
      session.organizationId,
      customerId,
      body,
    );

    return this.serializeCustomer(customer);
  }

  @Get(':customerId/addresses')
  @RequirePermissions('customers.read')
  async listCustomerAddresses(
    @CurrentSession() session: SessionContext,
    @Param('customerId', new ParseUUIDPipe({ version: '4' }))
    customerId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const addresses = await this.customerAddressesService.listByCustomerId(
      session.organizationId,
      customerId,
    );

    return addresses.map((address) => this.serializeAddress(address));
  }

  @Post(':customerId/addresses')
  @RequirePermissions('customers.manage')
  @HttpCode(201)
  async createCustomerAddress(
    @CurrentSession() session: SessionContext,
    @Param('customerId', new ParseUUIDPipe({ version: '4' }))
    customerId: string,
    @Body() body: CreateCustomerAddressDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const address = await this.customerAddressesService.create(
      session.organizationId,
      customerId,
      body,
    );

    return this.serializeAddress(address);
  }

  @Patch(':customerId/addresses/:addressId')
  @RequirePermissions('customers.manage')
  async updateCustomerAddress(
    @CurrentSession() session: SessionContext,
    @Param('customerId', new ParseUUIDPipe({ version: '4' }))
    customerId: string,
    @Param('addressId', new ParseUUIDPipe({ version: '4' }))
    addressId: string,
    @Body() body: UpdateCustomerAddressDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const address = await this.customerAddressesService.update(
      session.organizationId,
      customerId,
      addressId,
      body,
    );

    return this.serializeAddress(address);
  }

  @Get(':customerId/customs-profile')
  @RequirePermissions('customers.customs.read')
  async getCustomerCustomsProfile(
    @CurrentSession() session: SessionContext,
    @Param('customerId', new ParseUUIDPipe({ version: '4' }))
    customerId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const profile = await this.customerCustomsProfilesService.getByCustomerId(
      session.organizationId,
      customerId,
    );

    return this.serializeCustomsProfile(profile);
  }

  @Put(':customerId/customs-profile')
  @RequirePermissions('customers.customs.manage')
  async upsertCustomerCustomsProfile(
    @CurrentSession() session: SessionContext,
    @Param('customerId', new ParseUUIDPipe({ version: '4' }))
    customerId: string,
    @Body() body: UpsertCustomerCustomsProfileDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const profile = await this.customerCustomsProfilesService.upsertIdentity(
      session.organizationId,
      customerId,
      body,
    );

    return this.serializeCustomsProfile(profile);
  }

  @Patch(':customerId/customs-profile/verification')
  @RequirePermissions('customers.customs.manage')
  async updateCustomerCustomsVerification(
    @CurrentSession() session: SessionContext,
    @Param('customerId', new ParseUUIDPipe({ version: '4' }))
    customerId: string,
    @Body() body: UpdateCustomerCustomsVerificationDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const profile =
      await this.customerCustomsProfilesService.updateVerification(
        session.organizationId,
        customerId,
        body,
      );

    return this.serializeCustomsProfile(profile);
  }

  private setNoStore(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
  }

  private serializeCustomerList(result: CustomerListResult) {
    return {
      items: result.items.map((customer) => this.serializeCustomer(customer)),
      pagination: result.pagination,
    };
  }

  private serializeCustomer(customer: CustomerRecord) {
    return {
      id: customer.id,
      customerCode: customer.customerCode,
      type: customer.type,
      firstName: customer.firstName,
      lastName: customer.lastName,
      businessName: customer.businessName,
      displayName: this.buildDisplayName(customer),
      email: customer.email,
      phone: customer.phone,
      mobilePhone: customer.mobilePhone,
      status: customer.status,
      notes: customer.notes,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    };
  }

  private serializeAddress(address: CustomerAddressRecord) {
    return {
      id: address.id,
      type: address.type,
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
      countryCode: address.countryCode,
      isPrimary: address.isPrimary,
      isActive: address.isActive,
      createdAt: address.createdAt.toISOString(),
      updatedAt: address.updatedAt.toISOString(),
    };
  }

  private serializeCustomsProfile(profile: CustomerCustomsProfileRecord) {
    return {
      id: profile.id,
      documentType: profile.documentType,
      documentNumber: profile.documentNumber,
      ruaStatus: profile.ruaStatus,
      verificationSource: profile.verificationSource,
      lastCheckedAt: profile.lastCheckedAt?.toISOString() ?? null,
      verifiedAt: profile.verifiedAt?.toISOString() ?? null,
      externalReference: profile.externalReference,
      notes: profile.notes,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private buildDisplayName(customer: CustomerRecord): string {
    if (customer.businessName) {
      return customer.businessName;
    }

    const individualName = [customer.firstName, customer.lastName]
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0,
      )
      .join(' ')
      .trim();

    return individualName || customer.customerCode;
  }
}
