import React, { useState } from "react";
import { useFetch } from "@/src/lib/hooks";
import { formatCurrency } from "@/src/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from "@/src/components/ui";

export default function Pricing() {
  const { data: variants } = useFetch<any[]>("/api/variants");
  const { data: channels } = useFetch<any[]>("/api/channels");
  const { data: pricing, refetch } = useFetch<any[]>("/api/pricing");
  const [loading, setLoading] = useState<string | null>(null);

  const onUpdatePricing = async (variant_id: string, channel_id: string, sale_price: number, shipping_cost: number) => {
    setLoading(`${variant_id}-${channel_id}`);
    await fetch("/api/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variant_id, channel_id, sale_price, shipping_cost })
    });
    setLoading(null);
    refetch();
  };

  const onUpdateMRP = async (variant_id: string, mrp: number) => {
    setLoading(`${variant_id}-mrp`);
    await fetch(`/api/variants/${variant_id}/mrp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mrp })
    });
    setLoading(null);
    refetch(); // Actually should refetch variants later
  };

  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="flex justify-between items-end mb-[20px]">
        <div>
          <h1 className="text-[24px] font-[700] m-0">Channel Pricing & margins</h1>
          <p className="text-[13px] text-brand-muted m-0 mt-1">Manage separate sale prices and shipping costs for Amazon, Website, and Local shop per variant.</p>
        </div>
      </div>
      
      <div className="grid gap-[20px] flex-1 overflow-auto pb-4">
        {variants?.map(v => (
          <Card key={v.id} className="flex-shrink-0">
            <CardHeader>
              <div>
                <div className="flex justify-between items-center">
                  <CardTitle>{v.product_name} - {v.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wide text-brand-muted">Base MRP</span>
                    <Input 
                      type="number" 
                      className="w-24 h-7 text-right"
                      defaultValue={v.mrp || 0}
                      onBlur={(e) => onUpdateMRP(v.id, Number(e.target.value))}
                    />
                  </div>
                </div>
                <p className="text-[12px] text-brand-muted mt-1">Base Manufacturing Cost: <span className="font-[600] text-brand-text">{formatCurrency(v.total_manufacturing_cost)}</span></p>
              </div>
            </CardHeader>
            <CardContent className="p-4 bg-[#f8fafc]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-[16px]">
                {channels?.map(c => {
                  const p = pricing?.find(x => x.variant_id === v.id && x.channel_id === c.id) || { sale_price: 0, shipping_cost: 0 };
                  const salePrice = p.sale_price;
                  const shipping = p.shipping_cost;
                  const totalCost = v.total_manufacturing_cost + shipping;
                  const profit = salePrice - totalCost;
                  const marginPct = salePrice > 0 ? (profit / salePrice) * 100 : 0;
                  
                  return (
                    <div key={c.id} className="p-[16px] rounded-[8px] border border-brand-border bg-white flex flex-col justify-between">
                      <div>
                        <h4 className="font-[600] text-[13px]">{c.name} Pricing</h4>
                        <div className="mt-[16px] space-y-[12px]">
                          <div>
                            <label className="text-[11px] text-brand-muted uppercase tracking-[0.05em] mb-1 block">Sale Price (MRP)</label>
                            <Input 
                              type="number" 
                              defaultValue={salePrice} 
                              onBlur={(e) => onUpdatePricing(v.id, c.id, Number(e.target.value), shipping)}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-brand-muted uppercase tracking-[0.05em] mb-1 block">Shipping / Fees</label>
                            <Input 
                              type="number" 
                              defaultValue={shipping} 
                              onBlur={(e) => onUpdatePricing(v.id, c.id, salePrice, Number(e.target.value))}
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-[20px] pt-[12px] border-t border-brand-border grid grid-cols-2 gap-[8px] text-[13px]">
                        <div className="text-brand-muted">Gross Margin</div>
                        <div className="text-right font-[600]">
                          <span className={profit > 0 ? "text-brand-success" : profit < 0 ? "text-brand-danger" : ""}>
                            {formatCurrency(profit)}
                          </span>
                        </div>
                        <div className="text-brand-muted">Margin %</div>
                        <div className="text-right font-[600]">
                          <span className={marginPct > 20 ? "text-brand-success" : marginPct > 0 ? "text-brand-warning" : "text-brand-danger"}>
                            {marginPct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      {loading === `${v.id}-${c.id}` && <div className="mt-2 text-[11px] text-brand-accent text-center animate-pulse">Saving...</div>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
