-- Migration 007: ToyyibPay online payment fields on payments

alter table payments
  add column if not exists toyyibpay_bill_code text,
  add column if not exists toyyibpay_ref_no text,
  add column if not exists payment_channel text;   -- 'toyyibpay' | 'manual'

create index if not exists idx_payments_bill_code on payments(toyyibpay_bill_code);
