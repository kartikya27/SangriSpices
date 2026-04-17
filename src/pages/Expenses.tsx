import React, { useState } from "react";
import { useFetch } from "@/src/lib/hooks";
import { formatCurrency } from "@/src/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Label } from "@/src/components/ui";

export default function Expenses() {
  const { data: expenses, refetch } = useFetch<any[]>("/api/expenses");
  const [loading, setLoading] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setLoading(true);
    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: fd.get("category"),
        platform: fd.get("platform"),
        payment_mode: fd.get("payment_mode"),
        amount: Number(fd.get("amount")),
        date: fd.get("date") || new Date().toISOString(),
        end_date: fd.get("end_date") || null
      })
    });
    setLoading(false);
    form.reset();
    refetch();
  };

  const deleteExpense = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    setLoading(true);
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    setLoading(false);
    setConfirmDelete(null);
    refetch();
  };

  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="flex justify-between items-end mb-[20px]">
        <div>
          <h1 className="text-[24px] font-[700] m-0">Expenses Tracking</h1>
          <p className="text-[13px] text-brand-muted m-0 mt-1">Log fixed and variable non-product costs across the business</p>
        </div>
      </div>

      <div className="grid gap-[20px] grid-cols-[1fr_2fr] flex-1 min-h-0">
        <Card className="flex flex-col h-full overflow-hidden">
          <CardHeader>
            <CardTitle>Log Non-Product Expense</CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 overflow-auto">
            <form onSubmit={onSubmit} className="space-y-[16px]">
              <div className="grid grid-cols-2 gap-[8px]">
                <div>
                  <Label>Start Date</Label>
                  <Input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
                <div>
                  <Label>End Date (Optional)</Label>
                  <Input name="end_date" type="date" />
                </div>
              </div>
              <div>
                <Label>Category</Label>
                <Select name="category" required>
                  <option value="Software">Software / Apps</option>
                  <option value="Shipping">Shipping</option>
                  <option value="Shopdeck">Shopdeck</option>
                  <option value="AmazonAds">Amazon Ads</option>
                  <option value="Rent">Rent & Utilities</option>
                  <option value="Salaries">Salaries</option>
                  <option value="Misc">Miscellaneous</option>
                </Select>
              </div>
              <div>
                <Label>Amount (₹)</Label>
                <Input name="amount" type="number" step="0.01" required placeholder="0.00" />
              </div>
              <div>
                <Label>Platform / Vendor</Label>
                <Input name="platform" placeholder="e.g., Meta Ads, AWS" />
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select name="payment_mode" required>
                  <option value="Credit Card">Credit Card</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Save Expense
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="flex flex-col h-full overflow-hidden">
          <CardHeader>
            <CardTitle>Expense History</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Platform</th>
                  <th>Payment</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {expenses?.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50/50">
                    <td className="text-brand-muted">
                      {new Date(e.date).toLocaleDateString()}
                      {e.end_date && <span> - {new Date(e.end_date).toLocaleDateString()}</span>}
                    </td>
                    <td><span className="font-[600]">{e.category}</span></td>
                    <td>{e.platform || "-"}</td>
                    <td className="text-brand-muted">{e.payment_mode}</td>
                    <td style={{ textAlign: "right", color: "var(--color-brand-danger)", fontWeight: "600" }}>{formatCurrency(e.amount)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button onClick={() => deleteExpense(e.id)} className={`text-[12px] hover:underline ${confirmDelete === e.id ? 'text-brand-danger font-bold' : 'text-brand-danger'}`}>
                        {confirmDelete === e.id ? 'Sure?' : 'Del'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!expenses?.length && (
                  <tr>
                    <td colSpan={6} className="py-[32px] text-center text-brand-muted">No expenses recorded yet.</td>
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
