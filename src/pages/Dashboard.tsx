import React, { useState } from "react";
import { useFetch } from "@/src/lib/hooks";
import { formatCurrency, formatNumber } from "@/src/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Input, Select, Label } from "@/src/components/ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [productId, setProductId] = useState("");

  const queryParams = new URLSearchParams();
  if (startDate) queryParams.append("start_date", startDate);
  if (endDate) queryParams.append("end_date", endDate);
  if (productId) queryParams.append("product_id", productId);

  const { data: stats, loading } = useFetch<any>(`/api/dashboard?${queryParams.toString()}`);
  const { data: sales } = useFetch<any[]>(`/api/sales`);
  const { data: products } = useFetch<any[]>("/api/products");
  const { data: filteredSales } = useFetch<any[]>(`/api/sales`);

  if (loading || !stats) return <div className="p-8">Loading...</div>;

  let uiSales = filteredSales || [];
  if (startDate) uiSales = uiSales.filter(s => s.date >= startDate);
  if (endDate) uiSales = uiSales.filter(s => s.date <= endDate + "T23:59:59");
  if (productId) uiSales = uiSales.filter(s => s.product_id === productId);

  const last7Days: Record<string, number> = {};
  uiSales.forEach((s) => {
    const d = new Date(s.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    last7Days[d] = (last7Days[d] || 0) + (s.sale_price * s.qty);
  });
  const chartData = Object.keys(last7Days).map(k => ({ date: k, revenue: last7Days[k] }));

  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="flex justify-between items-end mb-[20px]">
        <div>
          <h1 className="text-[24px] font-[700] m-0">Profit Overview</h1>
          <p className="text-[13px] text-brand-muted m-0 mt-1">Real-time unit economics and channel margins</p>
        </div>
        <div className="flex gap-[12px] items-center bg-white border border-brand-border p-2 rounded-[8px] shadow-sm">
          <div className="flex flex-col">
            <Label className="text-[10px] text-brand-muted uppercase mb-1">Start Date</Label>
            <Input type="date" className="h-8 text-[12px]" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <Label className="text-[10px] text-brand-muted uppercase mb-1">End Date</Label>
            <Input type="date" className="h-8 text-[12px]" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <Label className="text-[10px] text-brand-muted uppercase mb-1">Product Filter</Label>
            <Select className="h-8 text-[12px] min-w-[150px]" value={productId} onChange={e => setProductId(e.target.value)}>
              <option value="">All Products</option>
              {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-5 gap-[16px] mb-[24px]">
        <div className="bg-white p-[16px] rounded-[8px] border border-brand-border shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.05em] text-brand-muted mb-[4px]">Total Revenue</div>
          <div className="text-[20px] font-[700]">{formatCurrency(stats.totalRevenue)}</div>
        </div>
        <div className="bg-white p-[16px] rounded-[8px] border border-brand-border shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.05em] text-brand-muted mb-[4px]">Data Range COGS</div>
          <div className="text-[20px] font-[700]">{formatCurrency(stats.totalCogs)}</div>
        </div>
        <div className="bg-white p-[16px] rounded-[8px] border border-brand-border shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.05em] text-brand-muted mb-[4px]">Marketing Spend</div>
          <div className="text-[20px] font-[700] text-brand-warning">{formatCurrency(stats.marketingSpend)}</div>
        </div>
        <div className="bg-white p-[16px] rounded-[8px] border border-brand-border shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.05em] text-brand-muted mb-[4px]">Gross Profit</div>
          <div className="text-[20px] font-[700] text-brand-success">{formatCurrency(stats.grossProfit)}</div>
        </div>
        <div className="bg-white p-[16px] rounded-[8px] border border-brand-border shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.05em] text-brand-muted mb-[4px]">Net Profit</div>
          <div className="text-[20px] font-[700] text-brand-accent">{formatCurrency(stats.netProfit)}</div>
        </div>
      </div>

      <div className="grid gap-[20px] grid-cols-[3fr_1fr] flex-1 min-h-0">
        <Card className="flex flex-col h-full overflow-hidden">
          <CardHeader>
            <CardTitle>Recent Revenue</CardTitle>
          </CardHeader>
          <CardContent className="p-4 h-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="revenue" fill="var(--color-brand-accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-[20px] overflow-hidden">
          <Card className="flex flex-col flex-shrink-0">
            <CardHeader>
              <CardTitle>Ad Performance (ROAS)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col gap-[12px]">
              <div>
                <div className="text-[12px] text-brand-muted">Return on Ad Spend</div>
                <div className="text-[24px] font-[700]">{stats.roas.toFixed(2)}x</div>
              </div>
              <div className="h-[1px] bg-brand-border w-full"></div>
              <div>
                <div className="text-[12px] text-brand-muted">Marketing % of Revenue</div>
                <div className="text-[18px] font-[600]">{stats.marketingPercent.toFixed(1)}%</div>
              </div>
              <div className="text-[11px] text-brand-muted mt-2">
                For every ₹1 spent on ads, you generate ₹{stats.roas.toFixed(2)} in sales revenue.
              </div>
            </CardContent>
          </Card>
          
          <Card className="flex flex-col flex-1 overflow-hidden">
            <CardHeader>
              <CardTitle>Recent Sales</CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex-1 overflow-auto">
              <div className="space-y-[12px]">
                {uiSales.length === 0 && <div className="text-[12px] text-brand-muted">No sales match this filter.</div>}
                {uiSales.slice(0, 5).map(sale => (
                  <div key={sale.id} className="flex flex-col border-b border-brand-border pb-[12px] last:border-0 last:pb-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[13px] font-[600]">{sale.product_name}</span>
                      <span className="font-[600] text-brand-success">+{formatCurrency(sale.sale_price * sale.qty)}</span>
                    </div>
                    <div className="text-[12px] text-brand-muted flex justify-between">
                      <span>{sale.variant_name}</span>
                      <span className="tag bg-[#f1f5f9] text-[#475569]">{sale.channel_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
