import { Injectable } from '@nestjs/common';
import 'dotenv/config';
import {
  InitializePaymentRequest,
  InitializePaymentResponse,
} from '../interface/types';
import axios from 'axios';

@Injectable()
export class PaystackService {
  private readonly PAYSTACK_API_BASE_URL = process.env.PAYSTACK_API_BASE_URL;
  private readonly API_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

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
