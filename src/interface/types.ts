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

interface Metadata {
  amount: string;
  wallet_id: string;
  user_id: string;
}

export interface InitializePaymentRequest {
  amount: string;
  email: string;
  currency?: string;
  callback_url?: string;
  metadata?: Metadata;
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

export interface VerifyTransactionResponse {
  status: boolean;
  message: string;
  data: Data;
}

interface Data {
  id: number;
  domain: string;
  status: string;
  reference: string;
  amount: number;
  message?: any;
  gateway_response: string;
  paid_at: string;
  created_at: string;
  channel: string;
  currency: string;
  ip_address: string;
  metadata: Metadata;
  log: Log;
  fees: number;
  fees_split?: any;
  authorization: Authorization;
  customer: Customer;
  plan?: any;
  split: any;
  order_id?: any;
  paidAt: string;
  createdAt: string;
  requested_amount: number;
  pos_transaction_data?: any;
  source?: any;
  fees_breakdown?: any;
  transaction_date: string;
  plan_object: any;
  subaccount: any;
}

interface Customer {
  id: number;
  first_name?: any;
  last_name?: any;
  email: string;
  customer_code: string;
  phone?: any;
  metadata?: any;
  risk_action: string;
  international_format_phone?: any;
}

interface Authorization {
  authorization_code: string;
  bin: string;
  last4: string;
  exp_month: string;
  exp_year: string;
  channel: string;
  card_type: string;
  bank: string;
  country_code: string;
  brand: string;
  reusable: boolean;
  signature: string;
  account_name?: any;
}

interface Log {
  start_time: number;
  time_spent: number;
  attempts: number;
  errors: number;
  success: boolean;
  mobile: boolean;
  input: any[];
  history: History[];
}

interface History {
  type: string;
  message: string;
  time: number;
}
