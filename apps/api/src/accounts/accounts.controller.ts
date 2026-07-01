import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../auth/http/public.decorator';
import { AccountsService } from './accounts.service';
import { ActivateAccountDto } from './dto/activate-account.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post('activate')
  @Public()
  @HttpCode(204)
  @Throttle({
    default: {
      limit: 10,
      ttl: 300_000,
    },
  })
  async activateAccount(
    @Body() body: ActivateAccountDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');

    await this.accountsService.activateAccount(body);
  }
}
