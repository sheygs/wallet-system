import { Test, TestingModule } from '@nestjs/testing';
import { WalletTransactionsController } from './wallet-transactions.controller';

describe('WalletTransactionsController', () => {
  let controller: WalletTransactionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletTransactionsController],
    }).compile();

    controller = module.get<WalletTransactionsController>(
      WalletTransactionsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
