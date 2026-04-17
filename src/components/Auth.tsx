import React, { useState } from "react";
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Label } from "@/src/components/ui";
import { Lock, Phone } from "lucide-react";

const ALLOWED_PHONES = ["9828051996", "8800599799"];

export default function Auth({ onLogin }: { onLogin: () => void }) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (ALLOWED_PHONES.includes(phone)) {
      localStorage.setItem("isLoggedIn", "true");
      onLogin();
    } else {
      setError("Unauthorized phone number. Access denied.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-brand-border">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-brand-accent/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="text-brand-accent" size={24} />
          </div>
          <CardTitle className="text-2xl font-bold">Access SpiceOS</CardTitle>
          <p className="text-brand-muted text-sm px-4">
            Enter your admin phone number to unlock the dashboard
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  id="phone"
                  type="text"
                  placeholder="Enter 10 digit number"
                  className="pl-10 h-11"
                  value={phone}
                  onChange={(e) => {
                    setError("");
                    setPhone(e.target.value.trim());
                  }}
                  required
                />
              </div>
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-600 text-xs p-3 rounded-md border border-red-100 italic">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-11 text-base font-semibold transition-all hover:scale-[1.01]">
              Unlock Dashboard
            </Button>
            
            <p className="text-[10px] text-center text-gray-400 uppercase tracking-widest pt-4">
              Authorized Personnel Only
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
