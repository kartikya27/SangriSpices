import React, { useState } from "react";
import { useFetch } from "@/src/lib/hooks";
import { formatCurrency } from "@/src/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select } from "@/src/components/ui";

export default function Products() {
  const { data: products, refetch: rProducts } = useFetch<any[]>("/api/products");
  const { data: rawMaterials } = useFetch<any[]>("/api/raw-materials");
  const { data: variants, refetch: rVariants } = useFetch<any[]>("/api/variants");
  
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  
  const deleteProduct = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!res.ok) {
       const data = await res.json();
       alert(data.error);
    }
    setLoading(false);
    setConfirmDelete(null);
    rProducts();
  };

  const deleteVariant = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/variants/${id}`, { method: "DELETE" });
    if (!res.ok) {
       const data = await res.json();
       alert(data.error);
    }
    setLoading(false);
    setConfirmDelete(null);
    rVariants();
  };

  const onProductSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setLoading(true);
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: fd.get("name"), description: fd.get("description") })
    });
    setLoading(false);
    form.reset();
    rProducts();
  };

  const onVariantSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setLoading(true);
    await fetch("/api/variants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: fd.get("product_id"),
        raw_material_id: fd.get("raw_material_id"),
        name: fd.get("name"),
        weight_grams: Number(fd.get("weight_grams")),
        packaging_cost: Number(fd.get("packaging_cost")),
        sticker_cost: Number(fd.get("sticker_cost")),
        stock_qty: Number(fd.get("stock_qty"))
      })
    });
    setLoading(false);
    form.reset();
    rVariants();
  };

  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="flex justify-between items-end mb-[20px]">
        <div>
          <h1 className="text-[24px] font-[700] m-0">Products & Variants</h1>
          <p className="text-[13px] text-brand-muted m-0 mt-1">Manage catalog and compute detailed manufacturing costs</p>
        </div>
      </div>

      <div className="grid gap-[20px] grid-cols-[1fr_2fr] flex-1 min-h-0">
        <div className="space-y-[20px] overflow-auto pr-[8px]">
          <Card className="flex-shrink-0">
            <CardHeader>
              <CardTitle>Base Products</CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col gap-4">
              <form onSubmit={onProductSubmit} className="flex gap-[8px]">
                <Input name="name" placeholder="e.g., Red Chilli" required className="flex-1" />
                <Button type="submit" disabled={loading}>Add</Button>
              </form>
              <div className="space-y-[4px] max-h-[150px] overflow-auto border border-brand-border rounded-[6px] p-2 bg-[#f8fafc]">
                 {products?.map(p => (
                    <div key={p.id} className="flex justify-between items-center bg-white p-2 border border-brand-border rounded-[4px] text-[13px]">
                       <span className="font-[500]">{p.name}</span>
                       <button onClick={() => deleteProduct(p.id)} className={`text-[12px] hover:underline ${confirmDelete === p.id ? 'text-brand-danger font-bold' : 'text-brand-danger'}`}>
                         {confirmDelete === p.id ? 'Sure?' : 'Delete'}
                       </button>
                    </div>
                 ))}
                 {!products?.length && <div className="text-center text-brand-muted text-[12px] p-2">No products added yet.</div>}
              </div>
            </CardContent>
          </Card>

          <Card className="flex-shrink-0">
            <CardHeader>
              <CardTitle>Create Variant</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={onVariantSubmit} className="space-y-[16px]">
                <div>
                  <Label>Base Product</Label>
                  <Select name="product_id" required>
                    <option value="">Select product...</option>
                    {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Variant Name</Label>
                    <Input name="name" placeholder="e.g., 250g Pouch" required />
                  </div>
                  <div>
                    <Label>Weight (grams)</Label>
                    <Input name="weight_grams" type="number" step="0.1" required />
                  </div>
                </div>
                
                <div>
                  <Label>Link Raw Material Batch</Label>
                  <Select name="raw_material_id" required>
                    <option value="">Select batch...</option>
                    {rawMaterials?.map(rm => <option key={rm.id} value={rm.id}>{rm.name} ({formatCurrency(rm.cost_per_gram)}/g)</option>)}
                  </Select>
                </div>

                <div>
                  <Label>Cost Breakdown (per unit)</Label>
                  <div className="grid grid-cols-2 gap-[8px]">
                    <Input name="packaging_cost" type="number" step="0.1" placeholder="Packaging (₹)" required />
                    <Input name="sticker_cost" type="number" step="0.1" placeholder="Sticker/Label (₹)" required />
                  </div>
                </div>

                <div>
                  <Label>Initial Stock Qty</Label>
                  <Input name="stock_qty" type="number" placeholder="0" defaultValue="0" />
                </div>

                <Button type="submit" variant="default" className="w-full" disabled={loading}>Create Variant</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="flex flex-col h-full overflow-hidden">
          <CardHeader>
            <CardTitle>Catalog & Cost Analysis</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 table-container">
            <table>
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>Batch</th>
                  <th style={{ textAlign: "right" }}>Raw Cost</th>
                  <th style={{ textAlign: "right" }}>Other Costs</th>
                  <th style={{ textAlign: "right", fontWeight: "bold" }}>Total Mfg Cost</th>
                  <th style={{ textAlign: "right" }}>Stock</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {variants?.map((v) => {
                  const rawCost = v.raw_material_cost;
                  const otherCosts = v.total_manufacturing_cost - rawCost;
                  return (
                    <tr key={v.id} className="hover:bg-gray-50/50">
                      <td>
                        <div className="font-[600]">{v.product_name}</div>
                        <div className="text-[11px] text-brand-muted">{v.name} ({v.weight_grams}g)</div>
                      </td>
                      <td><span className="mono">{v.rm_name}</span></td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(rawCost)}</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(otherCosts)}</td>
                      <td className="mono" style={{ textAlign: "right", fontWeight: "600", backgroundColor: "#f8fafc" }}>
                        {formatCurrency(v.total_manufacturing_cost)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className={v.stock_qty <= 10 ? "text-brand-danger font-bold" : "font-[600]"}>
                          {v.stock_qty}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button onClick={() => deleteVariant(v.id)} className={`text-[12px] hover:underline ${confirmDelete === v.id ? 'text-brand-danger font-bold' : 'text-brand-danger'}`}>
                          {confirmDelete === v.id ? 'Sure?' : 'Del'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {!variants?.length && (
                  <tr>
                    <td colSpan={7} className="py-[32px] text-center text-brand-muted">No variants created.</td>
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
