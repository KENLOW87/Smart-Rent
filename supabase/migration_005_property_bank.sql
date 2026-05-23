-- Migration 005: per-property recipient bank account for AI verification

alter table properties
  add column if not exists bank_account text,
  add column if not exists bank_name text,
  add column if not exists account_holder text;

-- New proof_status value: needs owner review (failed automatic checks)
alter type proof_status add value if not exists 'needs_review';
