import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ReconciliationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(private readonly db: DataSource) {}
  async check(): Promise<void> {
    const mismatches = await this.db.query(
      'SELECT wallet_id, difference FROM wallet_balance_reconciliation WHERE difference <> 0 LIMIT 20',
    );
    if (mismatches.length) {
      this.logger.error(
        `security.balance_reconciliation_failed ${JSON.stringify(mismatches)}`,
      );
      throw new Error('Wallet balance reconciliation failed');
    }
  }
  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV !== 'production') return;
    await this.check();
    this.timer = setInterval(() => {
      if (this.running) return;
      this.running = true;
      void this.check()
        .catch((error) =>
          this.logger.error(
            `security.reconciliation_check_failed ${error.message}`,
          ),
        )
        .finally(() => {
          this.running = false;
        });
    }, 60000);
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
