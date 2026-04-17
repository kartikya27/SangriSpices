import React, { useState, useEffect } from "react";
import { useFetch } from "@/src/lib/hooks";
import { formatCurrency } from "@/src/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from "@/src/components/ui";
import { Loader2, Save, IndianRupee, Truck } from "lucide-react";

export default function Pricing() {
  const { data: variants, refetch: rVariants } = useFetch<any[]>("/api/variants");
  const { data: channels } = useFetch<any[]>("/api/channels");
  const { data: pricing, refetch: rPricing } = useFetch<any[]>("/api/pricing");
  
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [localPricing, setLocalPricing] = useState<Record<string, any>>({});
  const [localMRPs, setLocalMRPs] = useState<Record<string, number>>({});

  // Sync local state when remote data arrives
  useEffect(() => {
    if (pricing) {
      const map: Record<string, any> = {};
      pricing.forEach(p => {
        map[`${p.variant_id}-${p.channel_id}`] = { 
          sale_price: p.sale_price, 
          shipping_cost: p.shipping_cost 
        };
      });
      setLocalPricing(map);
    }
  }, [pricing]);

  useEffect(() => {
    if (variants) {
      const map: Record<string, number> = {};
      variants.forEach(v => {
        map[v.id] = v.mrp || 0;
      });
      setLocalMRPs(map);
    }
  }, [variants]);

  const onUpdatePricing = async (variant_id: string, channel_id: string) => {
    const key = `${variant_id}-${channel_id}`;
    const data = localPricing[key] || { sale_price: 0, shipping_cost: 0 };
    
    setLoadingMap(prev => ({ ...prev, [key]: true }));
    try {
      await fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          variant_id, 
          channel_id, 
          sale_price: Number(data.sale_price), 
          shipping_cost: Number(data.shipping_cost) 
        })
      });
      await rPricing();
    } finally {
      setLoadingMap(prev => ({ ...prev, [key]: false }));
    }
  };

  const onUpdateMRP = async (variant_id: string) => {
    const mrp = localMRPs[variant_id] || 0;
    setLoadingMap(prev => ({ ...prev, [`${variant_id}-mrp`]: true }));
    try {
      await fetch(`/api/variants/${variant_id}/mrp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mrp: Number(mrp) })
      });
      await rVariants();
    } finally {
      setLoadingMap(prev => ({ ...prev, [`${variant_id}-mrp`]: false }));
    }
  };

  if (!variants || !channels || !pricing) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="flex justify-between items-end mb-[24px]">
        <div>
          <h1 className="text-[24px] font-[700] m-0">Pricing Central</h1>
          <p className="text-[13px] text-brand-muted m-0 mt-1">Manage MRP and channel-specific selling prices across all products.</p>
        </div>
      </div>
      
      <div className="space-y-[24px] pb-8 overflow-auto flex-1">
        {variants?.map(v => (
          <Card key={v.id} className="border-brand-border shadow-sm">
            <CardHeader className="border-b bg-gray-50/50 py-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-[16px]">{v.product_name} - {v.name}</CardTitle>
                  <p className="text-[12px] text-brand-muted mt-1">
                    Mfg. Cost: <span className="font-[600] text-brand-text">₹{v.total_manufacturing_cost}</span>
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold text-brand-muted">MRP</span>
                    <Input 
                      type="number" 
                      className="w-32 h-9 pl-12 text-right font-bold"
                      value={localMRPs[v.id] || ""}
                      onChange={(e) => setLocalMRPs({ ...localMRPs, [v.id]: Number(e.target.value) })}
                      onBlur={() => onUpdateMRP(v.id)}
                    />
                  </div>
                  {loadingMap[`${v.id}-mrp`] && <Loader2 className="w-4 h-4 animate-spin text-brand-accent" />}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-brand-muted border-b border-brand-border">
                      <th className="px-6 py-3 text-left font-bold">Channel</th>
                      <th className="px-6 py-3 text-left font-bold">Sale Price</th>
                      <th className="px-6 py-3 text-left font-bold">Shipping / Fee</th>
                      <th className="px-6 py-3 text-right font-bold">Gross Margin</th>
                      <th className="px-6 py-3 text-right font-bold">Margin %</th>
                      <th className="px-6 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {channels?.map(c => {
                      const key = `${v.id}-${c.id}`;
                      const data = localPricing[key] || { sale_price: 0, shipping_cost: 0 };
                      const salePrice = Number(data.sale_price);
                      const shipping = Number(data.shipping_cost);
                      const totalCost = v.total_manufacturing_cost + shipping;
                      const profit = salePrice - totalCost;
                      const marginPct = salePrice > 0 ? (profit / salePrice) * 100 : 0;

                      return (
                        <tr key={c.id} className="group hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-semibold text-brand-text">{c.name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="relative max-w-[124px]">
                              <IndianRupee size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-brand-muted" />
                              <Input 
                                type="number"
                                className="pl-6 h-8 text-[13px]"
                                value={data.sale_price || ""}
                                onChange={(e) => setLocalPricing({
                                  ...localPricing,
                                  [key]: { ...data, sale_price: e.target.value }
                                })}
                                onBlur={() => onUpdatePricing(v.id, c.id)}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="relative max-w-[124px]">
                              <Truck size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-brand-muted" />
                              <Input 
                                type="number"
                                className="pl-6 h-8 text-[13px]"
                                value={data.shipping_cost || ""}
                                onChange={(e) => setLocalPricing({
                                  ...localPricing,
                                  [key]: { ...data, shipping_cost: e.target.value }
                                })}
                                onBlur={() => onUpdatePricing(v.id, c.id)}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`text-[13px] font-bold ${profit > 0 ? "text-brand-success" : "text-brand-danger"}`}>
                              {formatCurrency(profit)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                               marginPct > 25 ? "bg-green-100 text-green-700" : 
                               marginPct > 10 ? "bg-orange-100 text-orange-700" : 
                               "bg-red-100 text-red-700"
                             }`}>
                               {marginPct.toFixed(1)}%
                             </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {loadingMap[key] && <Loader2 className="w-4 h-4 animate-spin text-brand-accent ml-auto" />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
