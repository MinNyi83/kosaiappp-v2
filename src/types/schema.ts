// src/types/schema.ts

export type TechnicianRole = 'Sales' | 'Technician' | 'Admin';
export type TechnicianPermission = 'read' | 'read_write';

export interface Technician {
  id: string;
  name: string;
  nickname?: string;
  role: TechnicianRole;
  phone?: string;
  active: number;
  email?: string;
  username?: string;
  password?: string;
  pin?: string;
  photo?: string;
  permissions?: TechnicianPermission;
}

export type AMCStatus = 'Active' | 'Inactive' | 'Expired' | 'No AMC' | 'Individual';

export interface Client {
  id: string;
  company_name: string;
  contact_person?: string;
  address: string;
  phone?: string;
  amc_start?: string;
  amc_end?: string;
  amc_status?: AMCStatus;
}

export type ServiceType = 'CCTV' | 'Networking' | 'WiFi' | 'NAS' | 'General Maintenance';
export type ServiceStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';

export interface ServiceRecord {
  id: string;
  client_id?: string;
  technician_id?: string;
  service_type: ServiceType;
  status?: ServiceStatus;
  job_description: string;
  technician_notes?: string;
  equipment_used?: string;
  before_photo?: string;
  after_photo?: string;
  arrival_time?: string;
  completion_time?: string;
  arrival_lat?: number;
  arrival_lng?: number;
  completion_lat?: number;
  completion_lng?: number;
  maps_url?: string;
  signature?: string;
  checklist_data?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryStock {
  item_code: string;
  item_name: string;
  category: string;
  stock_qty: number;
  unit_price: number;
  unit_price_mmk: number;
  batch_code?: string;
  buying_price: number;
}

export interface InventoryBatch {
  batch_code: string;
  item_code?: string;
  buying_price: number;
  supplier?: string;
  created_at?: string;
}

export type ItemStatus = 'Active' | 'Defective' | 'RMA Sent' | 'RMA Completed' | 'Replaced';

export interface InventoryItem {
  serial_number: string;
  device_name: string;
  client_id?: string;
  installed_date?: string;
  warranty_months?: number;
  status?: ItemStatus;
  distributor?: string;
  rma_tracking_id?: string;
  job_id?: string;
  batch_code?: string;
}

export interface CashSafe {
  id: number;
  usd_balance: number;
  mmk_balance: number;
}

export type TransactionType = 'Deposit' | 'Withdrawal';
export type Currency = 'USD' | 'MMK';

export interface CashTransaction {
  id: number;
  job_id?: string;
  transaction_type: TransactionType;
  primary_currency: Currency;
  amount: number;
  exchange_rate: number;
  equivalent_amount: number;
  notes?: string;
  created_at?: string;
  receive_mmk?: number;
  linked_batch?: string;
}

export interface ServiceFee {
  id: number;
  service_type: string;
  fee_amount: number;
  currency: Currency;
  description?: string;
}

export interface SystemConfig {
  config_key: string;
  config_value?: string;
}
