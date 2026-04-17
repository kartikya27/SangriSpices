import React, { useState } from "react";
import { LayoutDashboard, PackageSearch, Boxes, Tags, FileBarChart, CreditCard, Sparkles } from "lucide-react";
import { cn } from "@/src/lib/utils";
import Dashboard from "./pages/Dashboard";
import RawMaterials from "./pages/RawMaterials";
import Products from "./pages/Products";
import Pricing from "./pages/Pricing";
import Sales from "./pages/Sales";
import Expenses from "./pages/Expenses";
import Marketing from "./pages/Marketing";
import AIChat from "./pages/AIChat";
import Auth from "./components/Auth";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem("isLoggedIn") === "true");
  const [activeTab, setActiveTab] = useState("dashboard");

  if (!isLoggedIn) {
    return <Auth onLogin={() => setIsLoggedIn(true)} />;
  }

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "raw-materials", label: "Raw Materials", icon: PackageSearch },
    { id: "products", label: "Products & Variants", icon: Boxes },
    { id: "pricing", label: "Channel Pricing", icon: Tags },
    { id: "sales", label: "Sales & Orders", icon: FileBarChart },
    { id: "ai-filters", label: "AI Analytics", icon: Sparkles },
    { id: "marketing", label: "Marketing & Ads", icon: Tags },
    { id: "expenses", label: "Other Expenses", icon: CreditCard },
  ];

  return (
    <div className="flex h-screen w-full bg-brand-bg text-brand-text font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[200px] flex-shrink-0 border-r border-brand-border bg-brand-sidebar flex flex-col py-[20px]">
        <div className="px-[20px] pb-[30px] font-[800] text-[20px] text-brand-accent tracking-tight">
          SpiceOS
        </div>
        <nav className="flex-1 space-y-0 text-brand-muted">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex w-full items-center gap-[10px] px-[20px] py-[10px] text-[13px] font-[500] cursor-pointer transition-colors border-r-[3px]",
                  isActive
                    ? "bg-[#eff6ff] text-brand-accent border-brand-accent"
                    : "border-transparent hover:bg-gray-50 hover:text-brand-text"
                )}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-[24px] overflow-y-auto">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "raw-materials" && <RawMaterials />}
        {activeTab === "products" && <Products />}
        {activeTab === "pricing" && <Pricing />}
        {activeTab === "sales" && <Sales />}
        {activeTab === "ai-filters" && <AIChat />}
        {activeTab === "marketing" && <Marketing />}
        {activeTab === "expenses" && <Expenses />}
      </main>
    </div>
  );
}
