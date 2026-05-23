export type Role = 'owner' | 'agent' | 'tenant';
export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'late';

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
  telegram_chat_id: string | null;
  telegram_link_code: string | null;
  phone: string | null;
}

export interface Property {
  id: string;
  owner_id: string;
  name: string;
  address: string | null;
  rental_amount: number;
  due_day_of_month: number;
  notes: string | null;
  created_at: string;
}

export interface Tenant {
  id: string;
  property_id: string;
  profile_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  move_in_date: string | null;
  move_out_date: string | null;
  active: boolean;
}

export interface Payment {
  id: string;
  tenant_id: string;
  property_id: string;
  period_year: number;
  period_month: number;
  amount_due: number;
  amount_paid: number;
  paid_at: string | null;
  due_date: string;
  status: PaymentStatus;
  notes: string | null;
}
