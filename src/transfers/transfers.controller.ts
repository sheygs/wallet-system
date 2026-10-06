import { ApiHeader } from '@nestjs/swagger';
import { TransferStatus } from '../interface/types';
import {
  Controller,
  Req,
  Headers,
  Post,
  Body,
  Patch,
  UseGuards,
  Param,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  CreateTransferDTO,
  TransferIdDTO,
  ApproveTransferDTO,
} from './dto/transfer.dto';
import { WalletsService } from '../wallets/wallets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/RolesGuard';
import { Helpers } from '../utilities/helpers';
import { SuccessResponse } from '../interface/types';

@Controller('transfers')
export class TransfersController {
  constructor(
    private walletService: WalletsService,
    private helperService: Helpers,
  ) {}

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Reuse this key for retries of the same transfer request',
    schema: { type: 'string', minLength: 1, maxLength: 128 },
  })
  @Post('/')
  async createWalletTransfer(
    @Body() body: CreateTransferDTO,
    @Headers('idempotency-key') idempotencyKey: string,
    @Req() request: { user: { userId: string } },
  ): Promise<SuccessResponse> {
    const transfer = await this.walletService.transfer(
      body,
      request.user.userId,
      idempotencyKey,
    );

    return this.helperService.successResponse(
      HttpStatus.OK,
      transfer,
      transfer.status === TransferStatus.PENDING
        ? 'transfer pending approval'
        : 'transfer successful',
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @Patch('/:transfer_id/approve')
  async approveTransfer(
    @Param() { transfer_id }: TransferIdDTO,
    @Body() body: ApproveTransferDTO,
    @Req() request: { user: { userId: string } },
  ): Promise<SuccessResponse> {
    const transfer = await this.walletService.reviewTransfer(
      transfer_id,
      body.approved,
      request.user.userId,
    );

    return this.helperService.successResponse(
      HttpStatus.OK,
      transfer,
      body.approved ? 'transfer approved and executed' : 'transfer rejected',
    );
  }
}
