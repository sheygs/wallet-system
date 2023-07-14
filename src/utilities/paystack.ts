import { Injectable } from '@nestjs/common';
import {
  InitializePaymentRequest,
  InitializePaymentResponse,
} from '../interface/types';
import axios from 'axios';

@Injectable()
export class PaystackService {
  private readonly PAYSTACK_API_BASE_URL = 'https://api.paystack.co';
  private readonly API_SECRET_KEY =
    'sk_test_40441b9c4edbf780d27840960132c093f2d647ef';

  public async initializeTransaction(request: InitializePaymentRequest) {
    const { data } = await axios.post<InitializePaymentResponse>(
      `${this.PAYSTACK_API_BASE_URL}/transaction/initialize`,
      request,
      {
        headers: {
          Authorization: `Bearer ${this.API_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return data;
  }

  public async verifyTransaction(reference: string) {
    const { data } = await axios.get(
      `${this.PAYSTACK_API_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${this.API_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return data;
  }
}
