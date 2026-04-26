import React, { useState } from "react";
import { useFetch } from "@/src/lib/hooks";
import { formatCurrency } from "@/src/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button } from "@/src/components/ui";
import { Loader2 } from "lucide-react";

export default function FactoryPricing() {
  const { data: variants, refetch: rVariants } = useFetch<any[]>("/api/variants");
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  // Local state for temporary calculator editing
  const [localMap, setLocalMap] = useState<Record<string, { fPrice: string, iMargin: string }>>({});

  if (!variants) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  // Filter out sold out variants
  const activeVariants = variants.filter(v => v.is_sold_out !== 1);

  const getLocal = (vid: string) => {
    const v = activeVariants.find(x => x.id === vid);
    return localMap[vid] || {
      fPrice: v?.factory_price?.toString() || "0",
      iMargin: v?.ideal_margin?.toString() || "0"
    };
  };

  const onUpdateFields = (vid: string, updates: Partial<{ fPrice: string, iMargin: string }>) => {
    setLocalMap(prev => {
      const v = activeVariants.find(x => x.id === vid);
      const current = prev[vid] || {
        fPrice: v?.factory_price?.toString() || "0",
        iMargin: v?.ideal_margin?.toString() || "0"
      };
      return {
        ...prev,
        [vid]: { ...current, ...updates }
      };
    });
  };

  const savePricing = async (vid: string) => {
    const { fPrice, iMargin } = getLocal(vid);
    setLoadingMap(p => ({ ...p, [vid]: true }));
    try {
      await fetch(`/api/variants/${vid}/factory-pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          factory_price: Number(fPrice) || 0,
          ideal_margin: Number(iMargin) || 0
        })
      });
      await rVariants();
    } catch (e) {
      alert("Failed to save pricing");
    }
    setLoadingMap(p => ({ ...p, [vid]: false }));
  };

  return (
    <div className="flex flex-col flex-1 h-full relative">
      <div className="flex justify-between items-end mb-[20px]">
        <div>
          <h1 className="text-[24px] font-[700] m-0">Factory / Local Price Calculator</h1>
          <p className="text-brand-muted text-[13px] mt-1">
            Define ideal prices and calculate margins without shipping/channel costs.
          </p>
        </div>
      </div>

      <div className="space-y-[16px] pb-8 overflow-auto flex-1">
        {activeVariants.length === 0 ? (
          <div className="text-center p-8 text-brand-muted">No active variants found.</div>
        ) : null}
        
        {activeVariants.map(v => {
          const mfgCost = v.total_manufacturing_cost || 0;
          const { fPrice, iMargin } = getLocal(v.id);
          const currentPrice = Number(fPrice) || 0;
          
          let actualMarginNum = 0;
          if (currentPrice > 0) {
            actualMarginNum = ((currentPrice - mfgCost) / currentPrice) * 100;
          }

          return (
            <Card key={v.id} className="border-brand-border shadow-sm">
              <CardHeader className="border-b bg-gray-50/50 py-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-[15px]">{v.product_name} - {v.name} ({v.weight_grams}g)</CardTitle>
                    <div className="text-[12px] text-gray-500 font-mono mt-1">MFG Cost: {formatCurrency(mfgCost)}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 bg-white flex flex-col md:flex-row gap-6 items-end">
                
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[11px] text-gray-500">Ideal Margin (%)</Label>
                    <div className="flex gap-2">
                       <Input 
                         type="number" 
                         value={iMargin} 
                         onChange={e => {
                           const val = e.target.value;
                           const updates: any = { iMargin: val };
                           const m = Number(val);
                           if (!isNaN(m) && val !== "") {
                             const cost = v.total_manufacturing_cost || 0;
                             if (cost > 0) {
                               let suggestedPrice = 0;
                               if (m / 100 < 1) {
                                 suggestedPrice = cost / (1 - (m / 100));
                               } else {
                                 suggestedPrice = cost + (cost * (m / 100));
                               }
                               updates.fPrice = suggestedPrice.toFixed(0);
                             }
                           }
                           onUpdateFields(v.id, updates);
                         }} 
                         placeholder="e.g. 20"
                       />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-gray-500">Factory Selling Price</Label>
                    <Input 
                      type="number" 
                      value={fPrice} 
                      onChange={e => onUpdateFields(v.id, { fPrice: e.target.value })} 
                    />
                  </div>
                </div>

                <div className="w-[200px] flex flex-col justify-end">
                   <div className="flex justify-between items-center bg-gray-50 px-3 py-2 border rounded text-[13px] mb-2">
                      <span className="text-gray-500">Actual Margin:</span>
                      <span className={`font-bold ${actualMarginNum >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {actualMarginNum.toFixed(1)}%
                      </span>
                   </div>
                   <Button 
                     onClick={() => savePricing(v.id)} 
                     disabled={loadingMap[v.id]}
                     className="w-full h-8"
                   >
                     {loadingMap[v.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Factory Price"}
                   </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
