import React, { useState } from "react";
import { useFetch } from "@/src/lib/hooks";
import { formatCurrency } from "@/src/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from "@/src/components/ui";

export default function Marketing() {
  const { data: campaigns, refetch } = useFetch<any[]>("/api/marketing");
  const [loading, setLoading] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setLoading(true);
    await fetch("/api/marketing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: fd.get("platform"),
        campaign_name: fd.get("campaign_name"),
        start_date: fd.get("start_date") || new Date().toISOString().slice(0, 10),
        end_date: fd.get("end_date") || null,
        spend: Number(fd.get("spend"))
      })
    });
    setLoading(false);
    form.reset();
    refetch();
  };

  const deleteCampaign = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    setLoading(true);
    await fetch(`/api/marketing/${id}`, { method: "DELETE" });
    setLoading(false);
    setConfirmDelete(null);
    refetch();
  };

  const totalMarketingSpend = (campaigns || []).reduce((sum, c) => sum + (Number(c.spend) || 0), 0);

  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="flex justify-between items-end mb-[20px]">
        <div>
          <h1 className="text-[24px] font-[700] m-0">Marketing & Ads</h1>
          <p className="text-[13px] text-brand-muted m-0 mt-1">Manage ad campaigns, track spend, and analyze platform performance separately</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-4 py-2 rounded-md border border-brand-border shadow-sm flex flex-col items-end">
            <span className="text-[10px] text-brand-muted uppercase font-bold">Total Marketing Spend</span>
            <span className="text-[16px] font-bold text-brand-warning">{formatCurrency(totalMarketingSpend)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-[20px] grid-cols-[1fr_2fr] flex-1 min-h-0">
        <Card className="flex flex-col h-full overflow-hidden">
          <CardHeader>
            <CardTitle>Log Ad Spend</CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 overflow-auto">
            <form onSubmit={onSubmit} className="space-y-[16px]">
              <div>
                <Label>Platform</Label>
                <Input name="platform" placeholder="e.g. Meta Ads, Google Ads" required />
              </div>
              <div>
                <Label>Campaign Name / Category</Label>
                <Input name="campaign_name" placeholder="e.g. Diwali Sale Boost" />
              </div>
              <div className="grid grid-cols-2 gap-[8px]">
                <div>
                  <Label>Start Date</Label>
                  <Input name="start_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
                <div>
                  <Label>End Date (Optional)</Label>
                  <Input name="end_date" type="date" />
                </div>
              </div>
              <div>
                <Label>Total Spend (₹)</Label>
                <Input name="spend" type="number" step="0.01" required placeholder="0.00" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Save Ads Record
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="flex flex-col h-full overflow-hidden">
          <CardHeader>
            <CardTitle>Campaign History</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 table-container">
            <table>
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Campaign</th>
                  <th>Dates</th>
                  <th style={{ textAlign: "right" }}>Spend</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {campaigns?.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td><span className="font-[600]">{c.platform}</span></td>
                    <td>{c.campaign_name || "-"}</td>
                    <td className="text-[12px] text-brand-muted">
                      {new Date(c.start_date).toLocaleDateString()}
                      {c.end_date ? ` - ${new Date(c.end_date).toLocaleDateString()}` : ""}
                    </td>
                    <td style={{ textAlign: "right", color: "var(--color-brand-warning)", fontWeight: "600" }}>{formatCurrency(c.spend)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button onClick={() => deleteCampaign(c.id)} className={`text-[12px] hover:underline ${confirmDelete === c.id ? 'text-brand-danger font-bold' : 'text-brand-danger'}`}>
                        {confirmDelete === c.id ? 'Sure?' : 'Del'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!campaigns?.length && (
                  <tr>
                    <td colSpan={5} className="py-[32px] text-center text-brand-muted">No campaigns recorded yet.</td>
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
