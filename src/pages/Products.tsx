import React, { useState } from "react";
import { useFetch } from "@/src/lib/hooks";
import { formatCurrency } from "@/src/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select } from "@/src/components/ui";
import { X, Box } from "lucide-react";

export default function Products() {
  const { data: products, refetch: rProducts } = useFetch<any[]>("/api/products");
  const { data: rawMaterials } = useFetch<any[]>("/api/raw-materials");
  const { data: variants, refetch: rVariants } = useFetch<any[]>("/api/variants");
  const { data: combos, refetch: refetchCombos } = useFetch<any[]>("/api/combos");
  const { data: channels } = useFetch<any[]>("/api/channels");
  const { data: pricing } = useFetch<any[]>("/api/pricing");

  const activeRawMaterials = rawMaterials?.filter(rm => Number(rm.is_depleted) === 0 && (rm.category === 'Spice' || !rm.category)) || [];
  
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmSoldOut, setConfirmSoldOut] = useState<string | null>(null);
  const [isManageCombos, setIsManageCombos] = useState(false);
  
  const [comboForm, setComboForm] = useState<{name: string, price: string, items: {variant_id: string, qty: number}[]}>({
    name: "", price: "", items: [{variant_id: "", qty: 1}]
  });

  const onSaveCombo = async () => {
    if(!comboForm.name || !comboForm.price || comboForm.items.some(i => !i.variant_id)) return alert("Fill combo details properly");
    setLoading(true);
    await fetch("/api/combos", { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ name: comboForm.name, price: Number(comboForm.price), items_json: comboForm.items }) 
    });
    setComboForm({ name: "", price: "", items: [{variant_id: "", qty: 1}] });
    setLoading(false);
    refetchCombos();
  };

  const deleteCombo = async (id: string) => {
    if(!confirm("Delete this combo?")) return;
    setLoading(true);
    await fetch(`/api/combos/${id}`, { method: "DELETE" });
    setLoading(false);
    refetchCombos();
  };

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

  const markVariantSoldOut = async (id: string) => {
    if (confirmSoldOut !== id) {
      setConfirmSoldOut(id);
      setTimeout(() => setConfirmSoldOut(null), 3000);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/variants/${id}/mark-sold-out`, { method: "POST" });
    if (!res.ok) {
       const data = await res.json();
       alert(data.error);
    }
    setLoading(false);
    setConfirmSoldOut(null);
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
    <div className="flex flex-col flex-1 h-full relative">
      {isManageCombos && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-xl w-[500px] max-w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h2 className="text-[16px] font-[700]">Manage Combo Products</h2>
              <button onClick={() => setIsManageCombos(false)} className="text-gray-400 hover:text-black"><X size={20}/></button>
            </div>
            
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-3">
              <div className="grid grid-cols-[2fr_1fr] gap-3">
                <div>
                  <Label className="text-[11px]">Combo Name</Label>
                  <Input placeholder="e.g. Diwali Pack" value={comboForm.name} onChange={e => setComboForm({...comboForm, name: e.target.value})} className="h-8" />
                </div>
                <div>
                  <Label className="text-[11px]">Bundle Price (₹)</Label>
                  <Input type="number" placeholder="499" value={comboForm.price} onChange={e => setComboForm({...comboForm, price: e.target.value})} className="h-8" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px]">Ingredients / Variants in Combo</Label>
                {comboForm.items.map((ci, idx) => (
                   <div key={idx} className="flex gap-2">
                      <Select className="h-8 flex-1 text-[12px]" value={ci.variant_id} onChange={e => {
                        const newI = [...comboForm.items]; newI[idx].variant_id = e.target.value; setComboForm({...comboForm, items: newI});
                      }}>
                        <option value="">Select Variant...</option>
                        {variants?.filter(v => v.is_sold_out !== 1).map(v => <option key={v.id} value={v.id}>{v.product_name} - {v.name}</option>)}
                      </Select>
                      <Input type="number" min="1" className="h-8 w-[70px] text-[12px]" value={ci.qty} onChange={e => {
                        const newI = [...comboForm.items]; newI[idx].qty = Number(e.target.value); setComboForm({...comboForm, items: newI});
                      }} />
                      {comboForm.items.length > 1 && (
                        <Button variant="outline" className="h-8 px-2 text-red-500" onClick={() => {
                          const newI = [...comboForm.items]; newI.splice(idx, 1); setComboForm({...comboForm, items: newI});
                        }}><X size={14}/></Button>
                      )}
                   </div>
                ))}
                <div className="flex justify-between items-center mt-2">
                  <Button variant="outline" className="text-[11px] h-7 px-2" onClick={() => setComboForm({...comboForm, items: [...comboForm.items, {variant_id: "", qty: 1}]})}>
                     + Add Variant to Combo
                  </Button>
                  <Button className="h-7 text-[11px]" disabled={loading} onClick={onSaveCombo}>Save Combo</Button>
                </div>
              </div>
              
              <div className="bg-blue-50/50 border border-blue-100 rounded-md p-3 text-[12px] space-y-2 mt-2">
                <div className="font-[600] text-blue-900 border-b border-blue-100 pb-1 mb-1">Bundle Cost Analysis</div>
                <div className="flex justify-between items-center text-[13px]">
                   <span className="text-gray-600">Total Mfg / Base Cost:</span>
                   <span className="font-bold text-gray-800">
                     {formatCurrency(comboForm.items.reduce((sum, item) => sum + ((variants?.find(v => v.id === item.variant_id)?.total_manufacturing_cost || 0) * item.qty), 0))}
                   </span>
                </div>
                {channels?.length > 0 && (
                   <div className="mt-2 pt-2 border-t border-blue-100/50 space-y-1">
                     <span className="text-[10px] text-brand-muted uppercase font-bold">Sum of Active Channel Prices</span>
                     {channels.map((channel: any) => {
                       const channelTotal = comboForm.items.reduce((sum, item) => {
                         if (!item.variant_id) return sum;
                         const cPrice = pricing?.find(p => p.variant_id === item.variant_id && p.channel_id === channel.id);
                         const variant = variants?.find(v => v.id === item.variant_id);
                         const price = cPrice ? cPrice.sale_price : (variant?.mrp || 0);
                         return sum + (price * item.qty);
                       }, 0);
                       return (
                         <div key={channel.id} className="flex justify-between items-center text-[11px]">
                           <span className="text-gray-600">{channel.name}:</span>
                           <span className="font-medium text-gray-700">{formatCurrency(channelTotal)}</span>
                         </div>
                       );
                     })}
                   </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <h3 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-3">Saved Combos</h3>
              <div className="space-y-2">
                {combos?.length === 0 && <p className="text-[12px] text-gray-400">No combos created yet.</p>}
                {combos?.map((c: any) => (
                  <div key={c.id} className="border border-gray-100 p-3 rounded-md flex justify-between items-start">
                    <div>
                      <div className="font-[600] text-[13px]">{c.name} <span className="text-brand-success ml-2">₹{c.price}</span></div>
                      <div className="text-[11px] text-brand-muted mt-1 space-y-1">
                        {JSON.parse(c.items_json).map((ci: any, i:number) => {
                           const v = variants?.find(v => v.id === ci.variant_id);
                           return <div key={i}>• {v?.product_name} {v?.name} x {ci.qty}</div>
                        })}
                      </div>
                    </div>
                    <button onClick={() => deleteCombo(c.id)} className="text-[11px] text-red-500 hover:underline">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-end mb-[20px]">
        <div>
          <h1 className="text-[24px] font-[700] m-0">Products & Variants</h1>
          <p className="text-[13px] text-brand-muted m-0 mt-1">Manage catalog and compute detailed manufacturing costs</p>
        </div>
        <div className="flex gap-4 items-center">
          <Button variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50" onClick={() => setIsManageCombos(true)}>
             <Box size={16} className="mr-2"/> Manage Combos
          </Button>
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
                    <option value="">Select active batch...</option>
                    {activeRawMaterials.map(rm => <option key={rm.id} value={rm.id}>{rm.name} ({formatCurrency(rm.cost_per_gram)}/g)</option>)}
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

        <div className="flex flex-col h-full gap-4 overflow-auto pb-8">
          <Card className="flex flex-col flex-shrink-0">
            <CardHeader>
              <CardTitle>Variant Catalog & Cost Analysis</CardTitle>
            </CardHeader>
            <CardContent className="p-0 table-container">
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
                      <tr key={v.id} className={`hover:bg-gray-50/50 ${v.is_sold_out ? 'opacity-60' : ''}`}>
                        <td>
                          <div className="font-[600]">{v.product_name} {v.is_sold_out ? <span className="text-red-500 text-[10px] ml-1">[SOLD OUT]</span> : null}</div>
                          <div className="text-[11px] text-brand-muted">{v.name} ({v.weight_grams}g)</div>
                        </td>
                        <td><span className="mono">{v.rm_name}</span></td>
                        <td style={{ textAlign: "right" }}>{formatCurrency(rawCost)}</td>
                        <td style={{ textAlign: "right" }}>{formatCurrency(otherCosts)}</td>
                        <td className="mono" style={{ textAlign: "right", fontWeight: "600", backgroundColor: "#f8fafc" }}>
                          {formatCurrency(v.total_manufacturing_cost)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className={v.stock_qty <= 10 && !v.is_sold_out ? "text-brand-danger font-bold" : "font-[600]"}>
                            {v.stock_qty}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="flex flex-col gap-1 items-end">
                            {!v.is_sold_out && (
                              <button onClick={() => markVariantSoldOut(v.id)} className={`text-[11px] hover:underline ${confirmSoldOut === v.id ? 'text-brand-danger font-bold' : 'text-orange-600'}`}>
                                {confirmSoldOut === v.id ? 'Confirm?' : 'Mark Sold Out'}
                              </button>
                            )}
                            <button onClick={() => deleteVariant(v.id)} className={`text-[11px] hover:underline ${confirmDelete === v.id ? 'text-brand-danger font-bold' : 'text-gray-400'}`}>
                              {confirmDelete === v.id ? 'Sure?' : 'Delete'}
                            </button>
                          </div>
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

          <Card className="flex flex-col flex-shrink-0">
            <CardHeader>
              <CardTitle>Combo Catalog & Cost Analysis</CardTitle>
            </CardHeader>
            <CardContent className="p-0 table-container">
              <table>
                <thead>
                  <tr>
                    <th>Combo Name</th>
                    <th>Includes</th>
                    <th style={{ textAlign: "right", fontWeight: "bold" }}>Total Mfg Cost</th>
                    <th style={{ textAlign: "right", fontWeight: "bold" }}>Combo Price</th>
                    <th style={{ textAlign: "right", fontWeight: "bold" }}>Gross Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {combos?.map((c) => {
                    let items = [];
                    try { items = JSON.parse(c.items_json); } catch(e) {}
                    
                    let totalMfgCost = 0;
                    items.forEach((item: any) => {
                      const v = variants?.find(v => v.id === item.variant_id);
                      if (v) totalMfgCost += (v.total_manufacturing_cost || 0) * item.qty;
                    });
                    
                    const margin = c.price - totalMfgCost;

                    return (
                      <tr key={c.id} className="hover:bg-gray-50/50">
                        <td>
                          <div className="font-[600]">{c.name}</div>
                        </td>
                        <td>
                          <div className="text-[11px] text-brand-muted space-y-1">
                            {items.map((ci: any, i:number) => {
                               const v = variants?.find(v => v.id === ci.variant_id);
                               return <div key={i}>• {v?.product_name} {v?.name} x {ci.qty}</div>
                            })}
                          </div>
                        </td>
                        <td className="mono" style={{ textAlign: "right", fontWeight: "600", backgroundColor: "#f8fafc" }}>
                          {formatCurrency(totalMfgCost)}
                        </td>
                        <td className="mono text-brand-success" style={{ textAlign: "right", fontWeight: "600", backgroundColor: "#f8fafc" }}>
                          {formatCurrency(c.price)}
                        </td>
                        <td className="mono" style={{ textAlign: "right", fontWeight: "600", color: margin >= 0 ? "inherit" : "red" }}>
                          {formatCurrency(margin)}
                        </td>
                      </tr>
                    )
                  })}
                  {!combos?.length && (
                    <tr>
                      <td colSpan={5} className="py-[32px] text-center text-brand-muted">No combos created.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
