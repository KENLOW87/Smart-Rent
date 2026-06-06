-- Migration 008: per-owner payment settings
-- Each owner stores their own ToyyibPay credentials + bank details.
-- A property's rent routes to the property owner's account.

alter table profiles
  add column if not exists toyyibpay_secret_key text,
  add column if not exists toyyibpay_category_code text,
  add column if not exists bank_name text,
  add column if not exists bank_account_no text,
  add column if not exists bank_account_name text;
