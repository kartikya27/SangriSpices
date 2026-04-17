import React, { useState } from "react";
import { useFetch } from "@/src/lib/hooks";
import { formatCurrency, formatNumber } from "@/src/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select } from "@/src/components/ui";

export default function RawMaterials() {
  const { data: materials, refetch } = useFetch<any[]>("/api/raw-materials");
  const [loading, setLoading] = useState(false);
  const [unit, setUnit] = useState("kg");
  const [category, setCategory] = useState("Spice");
  const [entryMode, setEntryMode] = useState<"unit" | "total">("unit");

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setLoading(true);
    
    const qty = Number(fd.get("total_qty_kg"));
    let totalCost = 0;
    
    if (entryMode === "unit") {
      const unitRate = Number(fd.get("unit_rate"));
      totalCost = qty * unitRate;
    } else {
      totalCost = Number(fd.get("total_item_cost"));
    }

    await fetch("/api/raw-materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        category: fd.get("category"),
        unit: fd.get("unit"),
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
          <h1 className="text-[24px] font-[700] m-0">Procurement & Inventory</h1>
          <p className="text-[13px] text-brand-muted m-0 mt-1">Log bulk purchases of spices, packaging, and equipment</p>
        </div>
      </div>

      <div className="grid gap-[20px] grid-cols-[1.2fr_2.8fr] flex-1 min-h-0">
        <Card className="flex flex-col h-full overflow-hidden">
          <CardHeader>
            <CardTitle>Log New Purchase</CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 overflow-auto">
            <form onSubmit={onSubmit} className="space-y-[12px]">
              <div>
                <Label htmlFor="category">Item Category</Label>
                <Select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} required>
                  <option value="Spice">Spice / Ingredient</option>
                  <option value="Packaging">Packaging (Jars, Caps, Stickers)</option>
                  <option value="Equipment">Machinery / Equipment</option>
                  <option value="Utility">Other Supplies</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="name">Item Name</Label>
                <Input id="name" name="name" placeholder={category === 'Equipment' ? "e.g., Grinding Machine" : "e.g., Red Chilli Batch 2"} required />
              </div>

              <div className="grid grid-cols-2 gap-[8px]">
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Select id="unit" name="unit" value={unit} onChange={(e) => setUnit(e.target.value)} required>
                    <option value="kg">kilograms (kg)</option>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="unit">Units (unit)</option>
                    <option value="box">Boxes (box)</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="qty">Total Qty ({unit})</Label>
                  <Input id="qty" name="total_qty_kg" type="number" step="0.01" placeholder="e.g., 240" required />
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-[8px] border border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-[11px] uppercase tracking-wider text-brand-muted">Pricing Method</Label>
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={() => setEntryMode("unit")} 
                      className={`text-[10px] px-2 py-1 rounded ${entryMode === 'unit' ? 'bg-brand-accent text-white' : 'bg-white border border-brand-border'}`}
                    >
                      Rate / {unit}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setEntryMode("total")} 
                      className={`text-[10px] px-2 py-1 rounded ${entryMode === 'total' ? 'bg-brand-accent text-white' : 'bg-white border border-brand-border'}`}
                    >
                      Total Price
                    </button>
                  </div>
                </div>

                {entryMode === "unit" ? (
                  <div>
                    <Label htmlFor="unit_rate">Rate (₹ per {unit})</Label>
                    <Input id="unit_rate" name="unit_rate" type="number" step="0.01" placeholder="e.g., 200" required />
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="total_item_cost">Total Item Amount (₹)</Label>
                    <Input id="total_item_cost" name="total_item_cost" type="number" step="0.01" placeholder="e.g., 48000" required />
                    <p className="text-[10px] text-brand-muted mt-1 italic">The system will calculate the rate automatically.</p>
                  </div>
                )}
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
            <CardTitle>Purchase History & Stock</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category / Item</th>
                  <th style={{ textAlign: "right" }}>Quantity</th>
                  <th style={{ textAlign: "right" }}>Investment</th>
                  <th style={{ textAlign: "right" }}>Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {materials?.map((m: any) => (
                  <tr key={m.id} className={`hover:bg-gray-50/50 ${m.is_depleted ? 'opacity-50' : ''}`}>
                    <td className="text-brand-muted text-[11px] font-mono">{new Date(m.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">{m.category || 'Spice'}</div>
                      <div className="font-[600] flex items-center gap-2">
                        {m.name}
                      </div>
                      <div className="text-[10px] text-brand-muted mt-1">
                        Transport: {formatCurrency(m.transport_cost || 0)}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="font-[600]">{formatNumber(m.total_qty_kg)} <span className="text-[10px] text-brand-muted uppercase">{m.unit || 'kg'}</span></div>
                      {m.category === 'Spice' && (
                        <div className="text-[10px] text-brand-success font-bold">₹{m.cost_per_gram?.toFixed(4)}/g</div>
                      )}
                      {m.category === 'Packaging' && (
                        <div className="text-[10px] text-brand-success font-bold">₹{m.cost_per_unit?.toFixed(2)}/pc</div>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="font-[600]">
                        {formatCurrency((m.total_cost || 0) + (m.transport_cost || 0) + (m.operational_cost || 0))}
                      </div>
                      <div className="text-[10px] text-brand-muted">Base: ₹{m.total_cost}</div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button 
                        onClick={() => toggleDepleted(m.id, m.is_depleted)} 
                        className={`tag cursor-pointer ${m.is_depleted ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-600 border border-green-200'}`}
                        disabled={loading}
                      >
                        {m.is_depleted ? 'Sold Out' : 'Active'}
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
                    <td colSpan={6} className="py-[32px] text-center text-brand-muted">No items logged yet.</td>
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
