import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  Inject,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Response, Request } from 'express';
import { Helpers } from '../utilities/helpers';
import { ErrorResponse } from '../interface/types';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(Helpers) private helpers: Helpers,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  catch(error: any, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const status: number =
      error.response?.status ||
      error?.status ||
      error.response?.statusCode ||
      HttpStatus.INTERNAL_SERVER_ERROR;

    const message: string =
      error.response?.data?.message ||
      error.response?.data?.msg ||
      error.response?.message ||
      error.response?.error ||
      error?.message;

    const path: string = request ? request.url : null;

    const payloadResponse: ErrorResponse = this.helpers.errorResponse(
      status,
      message,
      path,
    );

    this.logger.error(`${JSON.stringify(payloadResponse)}`);

    response.status(status).json(payloadResponse);
  }
}
