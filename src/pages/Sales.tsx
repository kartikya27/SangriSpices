import React, { useState } from "react";
import { useFetch } from "@/src/lib/hooks";
import { formatCurrency, formatNumber } from "@/src/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Label } from "@/src/components/ui";
import { CopyPlus, X } from "lucide-react";

export default function Sales() {
  const { data: variants } = useFetch<any[]>("/api/variants");
  const { data: channels } = useFetch<any[]>("/api/channels");
  const { data: pricing } = useFetch<any[]>("/api/pricing");
  const { data: sales, refetch } = useFetch<any[]>("/api/sales");

  const [loading, setLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState("");
  
  // For multiple items form
  const [items, setItems] = useState<{ id: string, variant_id: string, qty: number, sale_price: string, shipping_cost: string, unit_cost: number }[]>([
    { id: 'initial', variant_id: "", qty: 1, sale_price: "", shipping_cost: "", unit_cost: 0 }
  ]);

  const updateItemPricing = (item: any, channelId: string, variantId: string) => {
    const activePricing = pricing?.find(p => p.variant_id === variantId && p.channel_id === channelId);
    const activeVariant = variants?.find(v => v.id === variantId);

    if (activePricing) {
       item.sale_price = String(activePricing.sale_price);
       item.shipping_cost = String(activePricing.shipping_cost);
    } else {
       // Fallback to MRP if no channel pricing found
       if (activeVariant && activeVariant.mrp) {
           item.sale_price = String(activeVariant.mrp);
       } else {
           item.sale_price = "";
       }
       item.shipping_cost = "0"; // Default shipping
    }
    
    if (activeVariant) {
       item.unit_cost = activeVariant.total_manufacturing_cost;
    }
    return item;
  };

  const handleVariantSelect = (index: number, variant_id: string) => {
    const newItems = [...items];
    newItems[index].variant_id = variant_id;
    newItems[index] = updateItemPricing(newItems[index], selectedChannel, variant_id);
    setItems(newItems);
  };

  const handleChannelSelect = (channelId: string) => {
    setSelectedChannel(channelId);
    const newItems = items.map(item => {
      if (item.variant_id) {
        return updateItemPricing({ ...item }, channelId, item.variant_id);
      }
      return item;
    });
    setItems(newItems);
  };

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const validItems = items.filter(i => i.variant_id && Number(i.qty) > 0);
    if (!validItems.length) {
      alert("Please add at least one valid item");
      return;
    }

    setLoading(true);
    await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel_id: selectedChannel,
        date: fd.get("date") || new Date().toISOString(),
        customer_phone: fd.get("customer_phone"),
        customer_address: fd.get("customer_address"),
        shipping_provider: fd.get("shipping_provider"),
        external_order_id: fd.get("external_order_id"),
        items: validItems.map(i => ({
          variant_id: i.variant_id,
          qty: Number(i.qty),
          sale_price: Number(i.sale_price),
          shipping_cost: Number(i.shipping_cost),
          unit_cost: i.unit_cost
        }))
      })
    });
    setLoading(false);
    setSelectedChannel("");
    setItems([{ id: Math.random().toString(), variant_id: "", qty: 1, sale_price: "", shipping_cost: "", unit_cost: 0 }]);
    form.reset();
    refetch();
  };

  const deleteSale = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    setLoading(true);
    await fetch(`/api/sales/${id}`, { method: "DELETE" });
    setLoading(false);
    setConfirmDelete(null);
    refetch();
  };

  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="flex justify-between items-end mb-[20px]">
        <div>
          <h1 className="text-[24px] font-[700] m-0">Sales Record</h1>
          <p className="text-[13px] text-brand-muted m-0 mt-1">Log transactions, adjust custom shipping per order line, and view real-time profitability snapshots per order</p>
        </div>
      </div>

      <div className="grid gap-[20px] grid-cols-1 lg:grid-cols-[4fr_5fr] flex-1 min-h-0">
        <Card className="flex flex-col h-full overflow-hidden">
          <CardHeader>
            <CardTitle>Log an Order</CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 overflow-auto">
            <form onSubmit={onSubmit} className="space-y-[20px]">
              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <Label>Date</Label>
                  <Input name="date" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} />
                </div>
                <div>
                  <Label>Sales Channel</Label>
                  <Select name="channel_id" required value={selectedChannel} onChange={e => handleChannelSelect(e.target.value)}>
                    <option value="">Select Channel...</option>
                    {channels?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <Label>External Order ID (Optional)</Label>
                  <Input name="external_order_id" placeholder="e.g. AMZ-12345" />
                </div>
                <div>
                  <Label>Shipping Provider</Label>
                  <Select name="shipping_provider">
                    <option value="">Select Provider...</option>
                    <option value="Amazon">Amazon</option>
                    <option value="Shiprocket">Shiprocket</option>
                    <option value="Delhivery">Delhivery</option>
                    <option value="BlueDart">BlueDart</option>
                    <option value="Self / Local">Self / Local</option>
                    <option value="Other">Other</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <Label>Customer Phone (Optional)</Label>
                  <Input name="customer_phone" placeholder="e.g. 9876543210" />
                </div>
                <div>
                  <Label>Customer Address (Optional)</Label>
                  <Input name="customer_address" placeholder="City, Pincode" />
                </div>
              </div>

              <div className="border border-brand-border rounded-[8px] p-2 bg-[#f8fafc] space-y-[12px]">
                <div className="flex justify-between items-center px-1">
                  <Label className="uppercase text-[11px] font-bold text-brand-muted">Order Line Items</Label>
                </div>
                {items.map((item, index) => (
                  <div key={item.id} className="relative bg-white border border-brand-border rounded-[6px] p-3 pt-6 shadow-sm">
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems(items.filter(i => i.id !== item.id))} className="absolute top-2 right-2 text-brand-muted hover:text-brand-danger">
                        <X size={14} />
                      </button>
                    )}
                    <div className="space-y-[10px]">
                      <div>
                        <Label>Variant Sold</Label>
                        <Select 
                          required 
                          value={item.variant_id} 
                          onChange={e => handleVariantSelect(index, e.target.value)}
                        >
                          <option value="">Select Variant...</option>
                          {variants?.map(v => <option key={v.id} value={v.id}>{v.product_name} - {v.name} (Stock: {v.stock_qty})</option>)}
                        </Select>
                      </div>
                      <div className="grid grid-cols-3 gap-[8px]">
                        <div>
                          <Label>Quantity</Label>
                          <Input 
                            type="number" 
                            min="1" 
                            required 
                            value={item.qty} 
                            onChange={e => {
                              const newItems = [...items];
                              newItems[index].qty = Number(e.target.value);
                              setItems(newItems);
                            }} 
                          />
                        </div>
                        <div>
                          <Label>Unit Price</Label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            required 
                            value={item.sale_price} 
                            onChange={e => {
                              const newItems = [...items];
                              newItems[index].sale_price = e.target.value;
                              setItems(newItems);
                            }} 
                          />
                        </div>
                        <div>
                          <Label>Shipping (Line)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={item.shipping_cost} 
                            onChange={e => {
                              const newItems = [...items];
                              newItems[index].shipping_cost = e.target.value;
                              setItems(newItems);
                            }} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                <Button type="button" variant="outline" className="w-full text-[13px]" onClick={() => setItems([...items, { id: Math.random().toString(), variant_id: "", qty: 1, sale_price: "", shipping_cost: "", unit_cost: 0 }])}>
                  <CopyPlus size={14} className="mr-2" /> Add Another Item
                </Button>
              </div>

              <Button type="submit" className="w-full" disabled={loading || !selectedChannel || !items.some(i => i.variant_id)}>
                Log Complete Order
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="flex flex-col h-full overflow-hidden">
          <CardHeader>
            <CardTitle>Recent Sales Lines</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 table-container">
            <table>
              <thead>
                <tr>
                  <th>Order/Date</th>
                  <th>Item Config</th>
                  <th style={{ textAlign: "right" }}>Rev & Ship</th>
                  <th style={{ textAlign: "right" }}>Profit</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sales?.map((s) => {
                  const profit = s.qty * s.sale_price - s.qty * (s.unit_cost + s.shipping_cost);
                  const margin = s.qty * s.sale_price > 0 ? (profit / (s.qty * s.sale_price)) * 100 : 0;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/50">
                      <td className="text-brand-muted">
                        <div className="font-mono text-[10px] text-gray-400 mb-1">
                          {s.external_order_id ? (
                            <span className="text-brand-accent font-bold">#{s.external_order_id}</span>
                          ) : (
                            s.order_id?.split('-')[0]
                          )}
                        </div>
                        <div className="text-[12px] font-medium">{new Date(s.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                        <div className="flex gap-1 mt-1">
                          <span className="tag bg-[#f1f5f9] text-[#475569]">{s.channel_name}</span>
                          {s.shipping_provider && (
                            <span className="tag bg-brand-accent/10 text-brand-accent border border-brand-accent/20">{s.shipping_provider}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="font-[600]">{s.product_name}</div>
                        <div className="text-[11px] text-brand-muted">{s.variant_name} x {formatNumber(s.qty)}</div>
                        {(s.customer_phone || s.customer_address) && (
                          <div className="text-[10px] text-brand-muted mt-1 truncate max-w-[120px]">{s.customer_phone} {s.customer_address}</div>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="font-[600]">{formatCurrency(s.qty * s.sale_price)}</div>
                        <div className="text-[10px] text-gray-400">Ship: {formatCurrency(s.qty * s.shipping_cost)}</div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className={profit >= 0 ? "text-brand-success font-[600]" : "text-brand-danger font-[600]"}>
                          {formatCurrency(profit)}
                        </div>
                        <div className="text-[10px] text-brand-muted">{margin.toFixed(1)}% mgn</div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button onClick={() => deleteSale(s.id)} className={`text-[12px] hover:underline ${confirmDelete === s.id ? 'text-brand-danger font-bold' : 'text-brand-danger'}`}>
                          {confirmDelete === s.id ? 'Sure?' : 'Del'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!sales?.length && (
                  <tr>
                    <td colSpan={5} className="py-[32px] text-center text-brand-muted">No sales recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
