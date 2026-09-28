export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'OPERATOR'
  | 'ACCOUNTANT'
  | 'NETWORK_ENGINEER'
  | 'READ_ONLY';

export type PlanType = 'TIME_BASED' | 'DATA_BASED' | 'HYBRID' | 'UNLIMITED';

export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'REVERSED';

export type PaymentProvider = 'MPESA_DARAJA' | 'VOUCHER' | 'MANUAL_OVERRIDE';

export type EntitlementStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'DEPLETED'
  | 'EXPIRED'
  | 'REVOKED';

export type SessionStatus =
  | 'ONLINE'
  | 'IDLE'
  | 'EXPIRED'
  | 'DISCONNECTED'
  | 'BLOCKED';

export type VoucherStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'USED'
  | 'EXPIRED'
  | 'DISABLED';

export interface BandwidthProfile {
  downloadSpeedKbps: number;
  uploadSpeedKbps: number;
  burstDownloadKbps?: number;
  burstUploadKbps?: number;
  burstThresholdDownKbps?: number;
  burstThresholdUpKbps?: number;
  burstDurationSeconds?: number;
  priority?: number; // 1-8, MikroTik default is 8
  minDownloadKbps?: number;
  minUploadKbps?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

export interface PlanDto {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  planType: PlanType;
  durationSec?: number | null;
  dataLimitBytes?: string | null; // serialized as string for bigints
  downloadSpeed: number;
  uploadSpeed: number;
  maxDevices: number;
  isActive: boolean;
}

export interface InitiatePaymentRequest {
  planId: string;
  phoneNumber: string;
  macAddress: string;
  ipAddress?: string;
  hostname?: string;
}

export interface RedeemVoucherRequest {
  code: string;
  macAddress: string;
  ipAddress?: string;
  phoneNumber?: string;
}
