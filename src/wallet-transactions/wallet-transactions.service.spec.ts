import { Test, TestingModule } from '@nestjs/testing';
import { WalletTransactionsService } from './wallet-transactions.service';

describe('WalletTransactionsService', () => {
  let service: WalletTransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletTransactionsService],
    }).compile();

    service = module.get<WalletTransactionsService>(WalletTransactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
