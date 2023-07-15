import { Injectable } from '@nestjs/common';
import { Status, SuccessResponse, ErrorResponse } from '../interface/types';

@Injectable()
export class Helpers {
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
  ): ErrorResponse {
    return {
      code,
      status: Status.FAILURE,
      data: null,
      error: {
        message: errorMessage,
        path,
      },
    };
  }
}
