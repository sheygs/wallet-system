import { Injectable } from '@nestjs/common';
import { SuccessResponse, Status } from './interface/types';

@Injectable()
export class AppService {
  baseMessage(): SuccessResponse {
    return {
      code: 200,
      status: Status.SUCCESS,
      message: 'okay',
      data: null,
    };
  }
}
