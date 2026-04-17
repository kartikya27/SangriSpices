import React from "react";

export type RawMaterial = {
  id: string;
  name: string;
  total_qty_kg: number;
  total_cost: number;
  cost_per_gram: number;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  created_at: string;
};

export type Variant = {
  id: string;
  product_id: string;
  raw_material_id: string;
  name: string;
  weight_grams: number;
  packaging_cost: number;
  sticker_cost: number;
  operational_cost: number;
  transport_cost: number;
  stock_qty: number;
  
  // Computed values
  rm_name?: string;
  product_name?: string;
  total_cost?: number;
  raw_material_cost: number;
  rm_cost_per_gram: number;
  total_manufacturing_cost: number;
};

export type Channel = {
  id: string;
  name: string;
};

export type Pricing = {
  id: string;
  variant_id: string;
  channel_id: string;
  sale_price: number;
  shipping_cost: number;
};

export type Sale = {
  id: string;
  date: string;
  channel_id: string;
  variant_id: string;
  qty: number;
  sale_price: number;
  unit_cost: number;
  shipping_cost: number;

  product_name?: string;
  variant_name?: string;
  channel_name?: string;
};

export type Expense = {
  id: string;
  category: string;
  platform: string;
  payment_mode: string;
  amount: number;
  date: string;
};
