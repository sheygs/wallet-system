export enum Roles {
  ADMIN = 'admin',
}

export enum Status {
  FAILURE = 'failure',
  SUCCESS = 'success',
}

export enum TransferStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
}

interface ErrorObject {
  id?: string | string[];
  message: string;
  path: string;
}

export interface SuccessResponse {
  code: number;
  status: Status.SUCCESS;
  message: string;
  data: any;
}

export interface ErrorResponse {
  code: number;
  status: Status.FAILURE;
  data: null;
  error: ErrorObject;
}

export interface InitializePaymentRequest {
  amount: string;
  email: string;
  currency?: string;
  callback_url?: string;
  metadata?: Record<string, any>;
}

export interface InitializePaymentResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}
