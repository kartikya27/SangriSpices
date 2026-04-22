import React, { useState } from "react";
import { useFetch } from "@/src/lib/hooks";
import { formatCurrency, formatNumber } from "@/src/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Label } from "@/src/components/ui";
import { CopyPlus, X, Box, Download } from "lucide-react";
import * as XLSX from "xlsx";

export default function Sales() {
  const { data: variants } = useFetch<any[]>("/api/variants");
  const { data: channels } = useFetch<any[]>("/api/channels");
  const { data: pricing } = useFetch<any[]>("/api/pricing");
  const { data: sales, refetch } = useFetch<any[]>("/api/sales");
  const { data: combos, refetch: refetchCombos } = useFetch<any[]>("/api/combos");

  const [loading, setLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");

  const filteredSales = sales?.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      s.external_order_id?.toLowerCase().includes(q) ||
      s.order_id?.toLowerCase().includes(q) ||
      s.product_name?.toLowerCase().includes(q) ||
      s.variant_name?.toLowerCase().includes(q) ||
      s.customer_phone?.toLowerCase().includes(q) ||
      s.customer_address?.toLowerCase().includes(q) ||
      s.channel_name?.toLowerCase().includes(q) ||
      s.combo_name?.toLowerCase().includes(q)
    );
  });

  const groupedSales = (filteredSales || []).reduce((acc: any[], item: any) => {
    const existingOrder = acc.find(o => o.order_id === item.order_id);
    const itemTotal = item.qty * item.sale_price;
    const itemGST = itemTotal * 0.05;
    const itemBaseRev = itemTotal - itemGST;
    const itemProfit = itemBaseRev - (item.qty * item.unit_cost + item.shipping_cost);

    if (existingOrder) {
      existingOrder.items.push(item);
      existingOrder.total_revenue += itemTotal;
      existingOrder.total_base_revenue += itemBaseRev;
      existingOrder.total_gst += itemGST;
      existingOrder.total_shipping += item.shipping_cost;
      existingOrder.total_profit += itemProfit;
      if (item.is_returned === 1) existingOrder.is_returned = 1;
    } else {
      acc.push({
        order_id: item.order_id,
        external_order_id: item.external_order_id,
        date: item.date,
        combo_name: item.combo_name,
        channel_name: item.channel_name,
        shipping_provider: item.shipping_provider,
        customer_phone: item.customer_phone,
        customer_address: item.customer_address,
        is_returned: item.is_returned === 1 ? 1 : 0,
        items: [item],
        total_revenue: itemTotal,
        total_base_revenue: itemBaseRev,
        total_gst: itemGST,
        total_shipping: item.shipping_cost,
        total_profit: itemProfit
      });
    }
    return acc;
  }, []);
  
  // For multiple items form
  const [items, setItems] = useState<{ id: string, variant_id: string, qty: number, sale_price: string, shipping_cost: string, unit_cost: number, combo_name?: string }[]>([
    { id: 'initial', variant_id: "", qty: 1, sale_price: "", shipping_cost: "", unit_cost: 0 }
  ]);

  const updateItemPricing = (item: any, channelId: string, variantId: string) => {
    const activePricing = pricing?.find(p => p.variant_id === variantId && p.channel_id === channelId);
    const activeVariant = variants?.find(v => v.id === variantId);

    if (activePricing) {
       item.sale_price = String(activePricing.sale_price);
       item.shipping_cost = String(activePricing.shipping_cost);
    } else {
       if (activeVariant && activeVariant.mrp) {
           item.sale_price = String(activeVariant.mrp);
       } else {
           item.sale_price = "";
       }
       item.shipping_cost = "0"; 
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

  const applyCombo = (comboId: string) => {
    const combo = combos?.find(c => c.id === comboId);
    if (!combo) return;
    
    const comboItems = JSON.parse(combo.items_json);
    const newItems = comboItems.map((ci: any, index: number) => {
       const activeVariant = variants?.find(v => v.id === ci.variant_id);
       return {
           id: Math.random().toString(),
           variant_id: ci.variant_id,
           qty: ci.qty,
           sale_price: index === 0 ? String(combo.price) : "0",
           shipping_cost: "0",
           unit_cost: activeVariant ? activeVariant.total_manufacturing_cost : 0,
           combo_name: combo.name
       }
    });

    // Remove empty items before adding combo
    setItems([...items.filter(i => i.variant_id !== ""), ...newItems]);
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

  const deleteOrder = async (orderId: string, isGroup: boolean) => {
    if (confirmDelete !== orderId) {
      setConfirmDelete(orderId);
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    setLoading(true);
    const url = isGroup ? `/api/orders/${orderId}` : `/api/sales/${orderId}`;
    await fetch(url, { method: "DELETE" });
    setLoading(false);
    setConfirmDelete(null);
    refetch();
  };

  const toggleReturn = async (orderId: string, isReturned: boolean) => {
    setLoading(true);
    await fetch(`/api/orders/${orderId}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_returned: !isReturned })
    });
    setLoading(false);
    refetch();
  };

  // Calculate Totals
  const activeOrders = groupedSales.filter((o: any) => o.is_returned !== 1);
  const totalActiveRevenue = activeOrders.reduce((sum: number, o: any) => sum + o.total_revenue, 0);
  const totalActiveProfit = activeOrders.reduce((sum: number, o: any) => sum + o.total_profit, 0);

  const downloadExcel = () => {
    if (!exportStartDate || !exportEndDate) {
      alert("Please select both start and end dates");
      return;
    }
    
    const start = new Date(exportStartDate).getTime();
    const end = new Date(exportEndDate).setHours(23, 59, 59, 999);

    const exportData = (sales || [])
      .filter((s: any) => {
        const d = new Date(s.date).getTime();
        return d >= start && d <= end;
      })
      .map((s: any) => {
        const totalRev = Number(s.sale_price) * Number(s.qty);
        const gst = totalRev * 0.05;
        const baseRev = totalRev - gst;
        
        return {
          "Order Date": new Date(s.date).toLocaleString(),
          "Order ID": s.order_id,
          "External Order ID": s.external_order_id || "N/A",
          "Channel": s.channel_name,
          "Product": s.product_name,
          "Variant": s.variant_name,
          "Combo": s.combo_name || "N/A",
          "Qty": s.qty,
          "Unit Price (Inc GST)": Number(s.sale_price).toFixed(2),
          "Total Revenue (Inc GST)": totalRev.toFixed(2),
          "Base Revenue (Exc GST)": baseRev.toFixed(2),
          "GST (5%)": gst.toFixed(2),
          "Shipping Cost": Number(s.shipping_cost).toFixed(2),
          "Mfg Unit Cost": Number(s.unit_cost).toFixed(2),
          "Customer Phone": s.customer_phone || "",
          "Customer Address": s.customer_address || "",
          "Shipping Provider": s.shipping_provider || "",
          "Returned": s.is_returned === 1 ? "Yes" : "No"
        };
      });

    if (exportData.length === 0) {
      alert("No sales found in this date range");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    XLSX.writeFile(wb, `Sales_Export_${exportStartDate}_to_${exportEndDate}.xlsx`);
    
    setShowExportModal(false);
  };

  return (
    <div className="flex flex-col flex-1 h-full relative">
      {/* EXPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-[12px] p-6 w-[400px] shadow-xl">
            <h2 className="text-lg font-bold mb-4">Download Sales (Excel)</h2>
            <div className="space-y-4">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setShowExportModal(false)}>Cancel</Button>
                <Button onClick={downloadExcel}>Download</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-end mb-[20px]">
        <div>
          <h1 className="text-[24px] font-[700] m-0">Sales Record</h1>
          <p className="text-[13px] text-brand-muted m-0 mt-1">Log transactions, adjust custom shipping per order line, and view real-time profitability snapshots per order</p>
        </div>
        <div className="flex gap-4 items-center">
          <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-50 h-[54px]" onClick={() => setShowExportModal(true)}>
             <Download size={16} className="mr-2"/> Excel Export
          </Button>
          <div className="bg-white px-4 py-2 rounded-md border border-brand-border shadow-sm flex flex-col items-end">
            <span className="text-[10px] text-brand-muted uppercase font-bold">Total Active Revenue</span>
            <span className="text-[16px] font-bold text-brand-text">{formatCurrency(totalActiveRevenue)}</span>
          </div>
          <div className="bg-white px-4 py-2 rounded-md border border-brand-border shadow-sm flex flex-col items-end">
            <span className="text-[10px] text-brand-muted uppercase font-bold">Total Active Profit</span>
            <span className="text-[16px] font-bold text-brand-success">{formatCurrency(totalActiveProfit)}</span>
          </div>
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
                
                <div className="flex gap-2 w-full mt-2">
                  <Button type="button" variant="outline" className="flex-1 text-[13px]" onClick={() => setItems([...items, { id: Math.random().toString(), variant_id: "", qty: 1, sale_price: "", shipping_cost: "", unit_cost: 0 }])}>
                    <CopyPlus size={14} className="mr-2" /> Add Single Variant
                  </Button>
                  {combos && combos.length > 0 && (
                     <Select className="flex-1 text-[13px] bg-purple-50 text-purple-700 border-purple-200" value="" onChange={(e) => {
                       if(e.target.value) {
                         applyCombo(e.target.value);
                       }
                     }}>
                        <option value="">+ Add Combo Bundle...</option>
                        {combos.map((c: any) => <option value={c.id} key={c.id}>{c.name} - ₹{c.price}</option>)}
                     </Select>
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading || !selectedChannel || !items.some(i => i.variant_id)}>
                Log Complete Order
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="flex flex-col h-full overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Recent Orders</CardTitle>
            <div className="flex items-center gap-2">
              <Input 
                placeholder="Search order, product, customer..." 
                className="h-8 text-[12px] w-[200px]" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 table-container">
            <table>
              <thead>
                <tr>
                  <th>Order/Date</th>
                  <th>Order Details</th>
                  <th style={{ textAlign: "right" }}>Rev & Ship</th>
                  <th style={{ textAlign: "right" }}>Taxes (5%)</th>
                  <th style={{ textAlign: "right" }}>Profit</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {groupedSales?.map((order: any) => {
                  const margin = order.total_base_revenue > 0 ? (order.total_profit / order.total_base_revenue) * 100 : 0;
                  const isGroup = !!order.order_id;
                  const deleteId = isGroup ? order.order_id : order.items[0].id;
                  
                  return (
                    <tr key={order.order_id || order.items[0].id} className={`hover:bg-gray-50/50 align-top ${order.is_returned ? 'opacity-50' : ''}`}>
                      <td className="text-brand-muted py-4">
                        <div className="font-mono text-[10px] text-gray-400 mb-1">
                          {order.external_order_id ? (
                            <span className="text-brand-accent font-bold">#{order.external_order_id}</span>
                          ) : (
                            order.order_id?.split('-')[0] || "N/A"
                          )}
                        </div>
                        <div className="text-[12px] font-medium">
                          {order.is_returned ? <span className="text-red-600 font-bold mr-1">[RETURNED]</span> : null}
                          {new Date(order.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {order.combo_name && (
                            <span className="tag bg-purple-100 text-purple-700 border border-purple-200">Combo: {order.combo_name}</span>
                          )}
                          <span className="tag bg-[#f1f5f9] text-[#475569]">{order.channel_name}</span>
                          {order.shipping_provider && (
                            <span className="tag bg-brand-accent/10 text-brand-accent border border-brand-accent/20">{order.shipping_provider}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="space-y-2">
                          {order.items.map((item: any, idx: number) => (
                            <div key={item.id} className={`${idx > 0 ? 'pt-2 border-t border-gray-100' : ''}`}>
                              <div className={`font-[600] text-[13px] ${order.is_returned ? 'line-through' : ''}`}>{item.product_name}</div>
                              <div className="text-[11px] text-brand-muted">{item.variant_name} x {formatNumber(item.qty)}</div>
                            </div>
                          ))}
                          {(order.customer_phone || order.customer_address) && (
                            <div className="text-[10px] bg-gray-50 p-1 rounded text-brand-muted mt-2">
                              {order.customer_phone} {order.customer_address}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }} className="py-4">
                        <div className={`font-[700] text-brand-text ${order.is_returned ? 'line-through text-brand-muted' : ''}`}>{formatCurrency(order.total_revenue)}</div>
                        <div className="text-[10px] text-gray-400 mt-1">Ship: +{formatCurrency(order.total_shipping)}</div>
                      </td>
                      <td style={{ textAlign: "right" }} className="py-4 bg-gray-50/50">
                        <div className={`font-[600] text-gray-700 ${order.is_returned ? 'line-through text-brand-muted' : ''}`}>{formatCurrency(order.total_gst)}</div>
                        <div className="text-[10px] text-gray-400 mt-1">Base: {formatCurrency(order.total_base_revenue)}</div>
                      </td>
                      <td style={{ textAlign: "right" }} className="py-4">
                        <div className={`${order.is_returned ? 'line-through text-brand-muted' : (order.total_profit >= 0 ? "text-brand-success" : "text-brand-danger")} font-[700]`}>
                          {formatCurrency(order.total_profit)}
                        </div>
                        <div className="text-[10px] text-brand-muted font-medium">{margin.toFixed(1)}% mgn</div>
                      </td>
                      <td style={{ textAlign: "right" }} className="py-4">
                        <div className="flex flex-col items-end gap-2">
                          <label className="flex items-center gap-1 text-[11px] cursor-pointer text-gray-600 hover:text-black">
                            <input 
                              type="checkbox" 
                              checked={!!order.is_returned}
                              onChange={() => toggleReturn(deleteId, !!order.is_returned)}
                              className="cursor-pointer"
                            />
                            Return
                          </label>
                          <button onClick={() => deleteOrder(deleteId, isGroup)} className={`text-[12px] hover:underline ${confirmDelete === deleteId ? 'text-brand-danger font-bold' : 'text-brand-danger'}`}>
                            {confirmDelete === deleteId ? 'Sure?' : 'Del'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!groupedSales?.length && (
                  <tr>
                    <td colSpan={6} className="py-[32px] text-center text-brand-muted">No orders found matching search.</td>
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
