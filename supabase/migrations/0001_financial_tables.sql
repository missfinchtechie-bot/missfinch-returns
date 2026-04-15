-- Phase 1: Shopify financial data tables
-- Run in Supabase SQL editor

create table if not exists shopify_orders (
  id text primary key,
  order_number bigint,
  name text not null,
  created_at timestamptz not null,
  processed_at timestamptz,
  cancelled_at timestamptz,
  financial_status text,
  currency text default 'USD',
  subtotal_price numeric(10,2) default 0,
  total_price numeric(10,2) default 0,
  total_tax numeric(10,2) default 0,
  total_discounts numeric(10,2) default 0,
  total_shipping numeric(10,2) default 0,
  total_refunded numeric(10,2) default 0,
  customer_id text,
  customer_email text,
  tags text,
  test boolean default false,
  synced_at timestamptz not null default now()
);

create index if not exists idx_shopify_orders_created on shopify_orders(created_at desc);
create index if not exists idx_shopify_orders_processed on shopify_orders(processed_at desc);

create table if not exists shopify_refunds (
  id text primary key,
  order_id text not null references shopify_orders(id) on delete cascade,
  created_at timestamptz not null,
  processed_at timestamptz,
  amount numeric(10,2) not null default 0,
  currency text default 'USD',
  note text,
  synced_at timestamptz not null default now()
);

create index if not exists idx_shopify_refunds_created on shopify_refunds(created_at desc);
create index if not exists idx_shopify_refunds_order on shopify_refunds(order_id);

create table if not exists shopify_transactions (
  id text primary key,
  order_id text,
  created_at timestamptz not null,
  type text,
  amount numeric(10,2) not null default 0,
  fee numeric(10,2) not null default 0,
  net numeric(10,2) not null default 0,
  currency text default 'USD',
  source_type text,
  source_id text,
  payout_id text,
  synced_at timestamptz not null default now()
);

create index if not exists idx_shopify_tx_created on shopify_transactions(created_at desc);
create index if not exists idx_shopify_tx_order on shopify_transactions(order_id);
create index if not exists idx_shopify_tx_source on shopify_transactions(source_type, source_id);

create table if not exists shopify_sync_state (
  key text primary key,
  last_synced_at timestamptz,
  cursor text,
  updated_at timestamptz default now()
);
