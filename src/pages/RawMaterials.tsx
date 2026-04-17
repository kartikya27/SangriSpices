import React, { useState } from "react";
import { useFetch } from "@/src/lib/hooks";
import { formatCurrency, formatNumber } from "@/src/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from "@/src/components/ui";

export default function RawMaterials() {
  const { data: materials, refetch } = useFetch<any[]>("/api/raw-materials");
  const [loading, setLoading] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setLoading(true);
    
    // Calculate total cost using (qty * unit_rate)
    const qty = Number(fd.get("total_qty_kg"));
    const unitRate = Number(fd.get("unit_rate"));
    const totalCost = qty * unitRate;

    await fetch("/api/raw-materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        total_qty_kg: qty,
        total_cost: totalCost,
        transport_cost: Number(fd.get("transport_cost")),
        operational_cost: Number(fd.get("operational_cost"))
      })
    });
    setLoading(false);
    form.reset();
    refetch();
  };

  const deleteRawMaterial = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/raw-materials/${id}`, { method: "DELETE" });
    if (!res.ok) {
       const data = await res.json();
       alert(data.error);
    }
    setLoading(false);
    setConfirmDelete(null);
    refetch();
  };

  const toggleDepleted = async (id: string, currentStatus: boolean) => {
    setLoading(true);
    await fetch(`/api/raw-materials/${id}/deplete`, { 
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_depleted: !currentStatus })
    });
    setLoading(false);
    refetch();
  };

  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="flex justify-between items-end mb-[20px]">
        <div>
          <h1 className="text-[24px] font-[700] m-0">Inventory</h1>
          <p className="text-[13px] text-brand-muted m-0 mt-1">Manage bulk raw material purchases and compute base costs</p>
        </div>
      </div>

      <div className="grid gap-[20px] grid-cols-[1fr_2fr] flex-1 min-h-0">
        <Card className="flex flex-col h-full overflow-hidden">
          <CardHeader>
            <CardTitle>Log Purchase Batch</CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 overflow-auto">
            <form onSubmit={onSubmit} className="space-y-[16px]">
              <div>
                <Label htmlFor="name">Raw Material Name</Label>
                <Input id="name" name="name" placeholder="e.g., Red Chilli Batch 2" required />
              </div>
              <div className="grid grid-cols-2 gap-[8px]">
                <div>
                  <Label htmlFor="qty">Total Qty (kg)</Label>
                  <Input id="qty" name="total_qty_kg" type="number" step="0.01" placeholder="e.g., 240" required />
                </div>
                <div>
                  <Label htmlFor="unit_rate">Unit Rate (₹/kg)</Label>
                  <Input id="unit_rate" name="unit_rate" type="number" step="0.01" placeholder="e.g., 200" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-[8px]">
                <div>
                  <Label htmlFor="transport_cost">Transport (₹)</Label>
                  <Input id="transport_cost" name="transport_cost" type="number" step="0.01" defaultValue="0" required />
                </div>
                <div>
                  <Label htmlFor="operational_cost">Operational / Labor (₹)</Label>
                  <Input id="operational_cost" name="operational_cost" type="number" step="0.01" defaultValue="0" required />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving..." : "Save Purchase"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="flex flex-col h-full overflow-hidden">
          <CardHeader>
            <CardTitle>Inventory & Batches</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Material</th>
                  <th style={{ textAlign: "right" }}>Cost Profile</th>
                  <th style={{ textAlign: "right", color: "var(--color-brand-success)" }}>Cost/Gram</th>
                  <th style={{ textAlign: "right" }}>Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {materials?.map((m: any) => (
                  <tr key={m.id} className={`hover:bg-gray-50/50 ${m.is_depleted ? 'opacity-50' : ''}`}>
                    <td className="text-brand-muted text-[11px]">{new Date(m.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="font-[600] flex items-center gap-2">
                        {m.name}
                        {m.is_depleted ? <span className="tag bg-gray-200 text-gray-500 text-[9px] uppercase">Sold Out</span> : <span className="tag bg-green-100 text-green-700 text-[9px] uppercase">Active</span>}
                      </div>
                      <div className="text-[10px] text-brand-muted mt-1">Trpt: {formatCurrency(m.transport_cost || 0)} | Ops: {formatCurrency(m.operational_cost || 0)}</div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="font-[500]">{formatNumber(m.total_qty_kg)} kg</div>
                      <div className="text-[11px] text-brand-muted">Total Run: {formatCurrency((m.total_cost || 0) + (m.transport_cost || 0) + (m.operational_cost || 0))}</div>
                    </td>
                    <td className="mono" style={{ textAlign: "right", color: "var(--color-brand-success)", fontWeight: "600" }}>
                      {formatCurrency(m.cost_per_gram)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button 
                        onClick={() => toggleDepleted(m.id, m.is_depleted)} 
                        className={`text-[11px] font-[500] hover:underline ${m.is_depleted ? 'text-brand-accent' : 'text-brand-warning'}`}
                        disabled={loading}
                      >
                        {m.is_depleted ? 'Mark Active' : 'Mark Sold Out'}
                      </button>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button onClick={() => deleteRawMaterial(m.id)} className={`text-[12px] hover:underline ${confirmDelete === m.id ? 'text-brand-danger font-bold' : 'text-brand-danger'}`}>
                        {confirmDelete === m.id ? 'Sure?' : 'Del'}
                      </button>
                    </td>
                  </tr>
                ))}
                {materials?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-[32px] text-center text-brand-muted">No raw materials logged yet.</td>
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
