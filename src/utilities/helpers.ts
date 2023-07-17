import { Injectable } from '@nestjs/common';
import 'dotenv/config';
import { Status, SuccessResponse, ErrorResponse } from '../interface/types';

@Injectable()
export class Helpers {
  readonly TRANSFER_AMOUNT = process.env.MININUM_APPROVAL_AMOUNT;

  successResponse(
    code: number,
    data: any | { [key: string]: string | number },
    message: string,
  ): SuccessResponse {
    return {
      code,
      status: Status.SUCCESS,
      message,
      data,
    };
  }

  errorResponse(
    code: number,
    errorMessage: string,
    path: string,
    name?: string,
  ): ErrorResponse {
    return {
      code,
      status: Status.FAILURE,
      data: null,
      error: {
        ...(name && { name }),
        message: errorMessage,
        path,
      },
    };
  }
}
