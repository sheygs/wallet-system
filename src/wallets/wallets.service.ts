import {
  assertIdempotencyKey,
  transferRequestHash,
} from '../transfers/idempotency';
import { TransferRequest } from '../transfers/transfer-request.entity';
import { TransferStatus } from '../interface/types';
import { getTransferApprovalThreshold } from '../transfers/transfer-policy';
import { User } from '../users/user.entity';
import { CreateWalletDTO, SearchWalletDTO } from './dtos/wallet.dto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { Transfer } from '../transfers/transfer.entity';
import { CreateTransferDTO } from '../transfers/dto/transfer.dto';
import {
  SUCCESSFUL_DEPOSIT_UNIQUE_INDEX,
  WalletTransaction,
  TransactionType,
  TransactionStatus,
} from '../wallet-transactions/wallet-transaction.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ACTIVE_WALLET_UNIQUE_INDEX, Currency, Wallet } from './wallet.entity';
import { PaystackService } from '../utilities/paystack';
import { VerifyTransactionResponse } from '../interface/types';

@Injectable()
export class WalletsService {
  private readonly approvalThreshold = getTransferApprovalThreshold();
  constructor(
    @InjectRepository(Wallet) private walletRepository: Repository<Wallet>,
    private paystackService: PaystackService,
    private dataSource: DataSource,
  ) {}

  assertOwner(wallet: Wallet, userId: string): void {
    if (wallet.user_id !== userId) {
      throw new ForbiddenException('Wallet belongs to another user');
    }
  }

  private checkedBalance(value: number, amount: number): number {
    const balance = Number(value);
    const result = balance + amount;
    if (
      !Number.isSafeInteger(balance) ||
      balance < 0 ||
      !Number.isSafeInteger(result) ||
      result < 0
    ) {
      throw new UnprocessableEntityException(
        'Balance is outside the supported range',
      );
    }
    return result;
  }

  private displayBalance(minorUnits: number): string {
    const value = BigInt(minorUnits);
    return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
  }

  private async lockTransferWallets(
    manager: EntityManager,
    sourceId: string,
    destinationId: string,
  ): Promise<{ source: Wallet; destination: Wallet }> {
    if (sourceId === destinationId) {
      throw new UnprocessableEntityException('Invalid transfer');
    }
    // Every settlement locks wallets in the same order, including approvals.
    const wallets = await manager
      .getRepository(Wallet)
      .createQueryBuilder('wallet')
      .where('wallet.id IN (:...ids)', { ids: [sourceId, destinationId] })
      .orderBy('wallet.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();

    const source = wallets.find((wallet) => wallet.id === sourceId);
    const destination = wallets.find((wallet) => wallet.id === destinationId);

    if (!source || !destination)
      throw new NotFoundException('Wallet account not found');

    if (source.currency !== destination.currency)
      throw new UnprocessableEntityException('Wallet currencies differ');

    return { source, destination };
  }

  private transferBalances(
    source: Wallet,
    destination: Wallet,
    amount: number,
  ) {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new UnprocessableEntityException('Invalid transfer amount');
    }

    if (Number(source.kobo_balance) < amount)
      throw new UnprocessableEntityException('Insufficient funds');

    return {
      sourceBalance: this.checkedBalance(source.kobo_balance, -amount),
      destinationBalance: this.checkedBalance(destination.kobo_balance, amount),
    };
  }

  private async settleTransfer(
    manager: EntityManager,
    transfer: Transfer,
    source: Wallet,
    destination: Wallet,
  ): Promise<void> {
    const amount = Number(transfer.transferred_amount);

    const { sourceBalance, destinationBalance } = this.transferBalances(
      source,
      destination,
      amount,
    );

    source.kobo_balance = sourceBalance;
    destination.kobo_balance = destinationBalance;
    source.balance = this.displayBalance(sourceBalance);
    destination.balance = this.displayBalance(destinationBalance);

    await manager.save(Wallet, [source, destination]);
    await manager.save(
      WalletTransaction,
      manager.create(WalletTransaction, {
        user_id: transfer.requested_by,
        source_wallet_id: source.id,
        amount,
        reference: `transfer:${transfer.id}`,
        transaction_type: TransactionType.TRANSFER,
        transaction_status: TransactionStatus.SUCCESSFUL,
      }),
    );
  }

  private restoreTransferResponse(
    manager: EntityManager,
    response: Record<string, unknown>,
  ): Transfer {
    const transfer = manager.create(Transfer, response as Partial<Transfer>);
    transfer.created_at = new Date(String(response.created_at));
    transfer.updated_at = new Date(String(response.updated_at));
    if (response.reviewed_at != null)
      transfer.reviewed_at = new Date(String(response.reviewed_at));
    return transfer;
  }

  async transfer(
    body: CreateTransferDTO,
    userId: string,
    idempotencyKey: string,
  ): Promise<Transfer> {
    assertIdempotencyKey(idempotencyKey);
    if (
      typeof userId !== 'string' ||
      !userId ||
      typeof body.source_wallet_id !== 'string' ||
      typeof body.destination_wallet_id !== 'string' ||
      !Number.isSafeInteger(body.amount) ||
      body.amount <= 0
    ) {
      throw new UnprocessableEntityException('Invalid transfer');
    }
    userId = userId.toLowerCase();
    body = {
      ...body,
      source_wallet_id: body.source_wallet_id.toLowerCase(),
      destination_wallet_id: body.destination_wallet_id.toLowerCase(),
    };
    const { source_wallet_id, destination_wallet_id, amount, reason } = body;
    try {
      return await this.dataSource.transaction(
        'READ COMMITTED',
        async (manager) => {
          // Same user/key requests serialize before inspecting balances. Failed
          // transactions release the key; committed requests retain their snapshot.
          await manager.query(
            'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
            [JSON.stringify(['transfer', userId, idempotencyKey])],
          );
          const [existing]: TransferRequest[] = await manager.query(
            'SELECT request_hash, response FROM transfer_requests WHERE user_id = $1 AND idempotency_key = $2',
            [userId, idempotencyKey],
          );
          if (existing) {
            const fingerprint = transferRequestHash(
              body,
              existing.response.currency as Currency,
            );
            if (existing.request_hash !== fingerprint)
              throw new ConflictException(
                'Idempotency-Key was already used for a different transfer request',
              );
            return this.restoreTransferResponse(manager, existing.response);
          }
          const { source, destination } = await this.lockTransferWallets(
            manager,
            source_wallet_id,
            destination_wallet_id,
          );
          this.assertOwner(source, userId);
          if (body.currency != null && body.currency !== source.currency)
            throw new UnprocessableEntityException(
              'Transfer currency does not match wallet',
            );
          this.transferBalances(source, destination, amount);
          const requiresApproval = amount > this.approvalThreshold;
          const transfer = await manager.save(
            Transfer,
            manager.create(Transfer, {
              source_wallet_id,
              destination_wallet_id,
              reason,
              currency: source.currency,
              transferred_amount: amount,
              requested_by: userId,
              requires_approval: requiresApproval,
              approved: false,
              status: requiresApproval
                ? TransferStatus.PENDING
                : TransferStatus.EXECUTED,
            }),
          );
          if (!requiresApproval)
            await this.settleTransfer(manager, transfer, source, destination);
          await manager.query(
            'INSERT INTO transfer_requests (user_id, idempotency_key, request_hash, transfer_id, response) VALUES ($1, $2, $3, $4, $5::jsonb)',
            [
              userId,
              idempotencyKey,
              transferRequestHash(body, source.currency),
              transfer.id,
              JSON.stringify(transfer),
            ],
          );
          return transfer;
        },
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.driverError?.code === '23505' &&
        error.driverError?.constraint === 'transfer_requests_pkey'
      ) {
        throw new ConflictException(
          'Idempotency-Key is already recorded; retry the original request',
        );
      }
      throw error;
    }
  }

  async reviewTransfer(
    transferId: string,
    approved: boolean,
    reviewerId: string,
  ): Promise<Transfer> {
    if (!transferId || !reviewerId || typeof approved !== 'boolean') {
      throw new UnprocessableEntityException('Invalid transfer review');
    }
    return this.dataSource.transaction(async (manager) => {
      const reviewer = await manager.findOne(User, {
        where: { id: reviewerId },
        lock: { mode: 'pessimistic_read' },
      });

      if (reviewer?.is_admin !== true)
        throw new ForbiddenException('Administrator access required');

      // Hold the request lock until balances, ledger, and review are committed.
      const transfer = await manager.findOne(Transfer, {
        where: { id: transferId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!transfer) throw new NotFoundException('transfer not found');

      if (
        transfer.status !== TransferStatus.PENDING ||
        !transfer.requires_approval
      ) {
        throw new ConflictException('Transfer is not pending approval');
      }

      if (approved) {
        const { source, destination } = await this.lockTransferWallets(
          manager,
          transfer.source_wallet_id,
          transfer.destination_wallet_id,
        );

        this.assertOwner(source, transfer.requested_by);

        if (transfer.currency !== source.currency)
          throw new UnprocessableEntityException(
            'Transfer currency no longer matches wallet',
          );

        await this.settleTransfer(manager, transfer, source, destination);
      }

      transfer.approved = approved;
      transfer.status = approved
        ? TransferStatus.EXECUTED
        : TransferStatus.REJECTED;

      transfer.reviewed_by = reviewerId;
      transfer.reviewed_at = new Date();
      return manager.save(Transfer, transfer);
    });
  }

  async deposit(reference: string, userId: string): Promise<void> {
    if (typeof reference !== 'string' || reference.trim().length === 0) {
      throw new UnprocessableEntityException('Payment reference is required');
    }
    const { data } = await this.verifyPaymentTransaction(reference);

    if (
      data.status !== 'success' ||
      data.reference !== reference ||
      !Number.isSafeInteger(data.amount) ||
      data.amount <= 0
    ) {
      throw new UnprocessableEntityException(
        'Payment is not successful or amount is invalid',
      );
    }

    const walletId = data.metadata?.wallet_id;

    if (!walletId)
      throw new UnprocessableEntityException('Payment has no wallet metadata');

    try {
      await this.dataSource.transaction(async (manager) => {
        // Serialize each reference, even if requests try different wallet IDs.
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [reference],
        );

        const wallet = await manager.findOne(Wallet, {
          where: { id: walletId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!wallet) throw new NotFoundException('Wallet account not found');

        this.assertOwner(wallet, userId);

        if (
          data.currency !== wallet.currency ||
          data.metadata.user_id !== userId
        ) {
          throw new UnprocessableEntityException(
            'Payment metadata does not match wallet',
          );
        }

        const existing = await manager.findOne(WalletTransaction, {
          where: {
            reference,
            transaction_type: TransactionType.DEPOSIT,
            transaction_status: TransactionStatus.SUCCESSFUL,
          },
        });

        if (existing) throw new ConflictException('Payment already credited');

        wallet.kobo_balance = this.checkedBalance(
          wallet.kobo_balance,
          data.amount,
        );

        wallet.balance = this.displayBalance(Number(wallet.kobo_balance));

        await manager.save(Wallet, wallet);
        await manager.save(
          WalletTransaction,
          manager.create(WalletTransaction, {
            user_id: userId,
            source_wallet_id: walletId,
            amount: data.amount,
            reference,
            transaction_type: TransactionType.DEPOSIT,
            transaction_status: TransactionStatus.SUCCESSFUL,
          }),
        );
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.driverError?.code === '23505' &&
        error.driverError?.constraint === SUCCESSFUL_DEPOSIT_UNIQUE_INDEX
      ) {
        throw new ConflictException('Payment already credited');
      }
      throw error;
    }
  }

  async createWallet(body: CreateWalletDTO): Promise<Wallet> {
    const currency = body.currency ?? Currency.NGN;

    await this.searchWallet({ user_id: body.user_id, currency });

    const wallet = this.walletRepository.create({
      user_id: body.user_id,
      currency,
    });

    try {
      return await this.walletRepository.save(wallet);
    } catch (error) {
      // A second request may pass the precheck before the first insert commits.
      // PostgreSQL is authoritative; only this specific conflict becomes HTTP 409.
      if (
        error instanceof QueryFailedError &&
        error.driverError?.code === '23505' &&
        error.driverError?.constraint === ACTIVE_WALLET_UNIQUE_INDEX
      ) {
        throw new ConflictException(
          'Wallet of the specified currency already exists',
        );
      }
      throw error;
    }
  }

  async getWalletByID(wallet_id: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({
      where: {
        id: wallet_id,
      },

      relations: {
        user: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet account not found');
    }

    return wallet;
  }

  async searchWallet(params: SearchWalletDTO): Promise<Wallet> {
    const user_id = params.user_id;
    const currency = params.currency ?? Currency.NGN;

    const wallet = await this.walletRepository.findOne({
      where: {
        user_id,
        currency,
      },
    });

    if (wallet) {
      throw new ConflictException(
        'Wallet of the specified currency already exists',
      );
    }

    return wallet;
  }

  async getWalletBalance(id: string): Promise<number | string> {
    const wallet = await this.getWalletByID(id);

    return wallet.balance;
  }

  async initializePaymentTransaction(payload: any): Promise<{
    authorization_url: string;
  }> {
    const { amount, email, currency, wallet_id, user_id } = payload;

    const response = await this.paystackService.initializeTransaction({
      amount,
      email,
      currency,
      metadata: {
        amount,
        wallet_id,
        user_id,
        currency,
      },
    });

    if (!response) {
      throw new UnprocessableEntityException(
        'Paystack payment initiailzation failed',
      );
    }

    if (!response.status) {
      throw new UnprocessableEntityException(response.message);
    }

    return { authorization_url: response.data.authorization_url };
  }

  async verifyPaymentTransaction(
    reference: string,
  ): Promise<VerifyTransactionResponse> {
    const transaction = await this.paystackService.verifyTransaction(reference);

    if (!transaction.status) {
      throw new UnprocessableEntityException(transaction.message);
    }

    return transaction;
  }
}
