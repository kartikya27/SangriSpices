import React, { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import { Send, Bot } from "lucide-react";
import { Button, Input } from "@/src/components/ui";

export default function AIChat() {
  const [messages, setMessages] = useState<{ role: 'user'|'ai', content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMsg })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessages(prev => [...prev, { role: 'ai', content: data.result }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', content: `**Error:** ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full max-w-4xl mx-auto w-full">
      <div className="mb-[20px]">
        <h1 className="text-[24px] font-[700] m-0 flex items-center gap-2">
          <Bot size={28} className="text-brand-accent" />
          AI Analytics & Filters
        </h1>
        <p className="text-[13px] text-brand-muted m-0 mt-1">Ask anything about your data—"Show sales from today", "Calculate total profit for Red Chilli", or "List all orders to Mumbai"</p>
      </div>

      <div className="flex-1 min-h-0 bg-white border border-brand-border rounded-[12px] flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-[20px] space-y-[24px]">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-brand-muted">
              <Bot size={48} className="mb-4 text-gray-300" />
              <p>Type a question below to analyze your SpiceOS data.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-[12px] p-[16px] text-[14px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-brand-accent text-white rounded-br-none' : 'bg-[#f8fafc] border border-brand-border text-brand-text rounded-bl-none'}`}>
                {msg.role === 'ai' ? (
                  <div className="markdown-body">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-[12px] p-[16px] text-[14px] text-brand-muted bg-[#f8fafc] border border-brand-border rounded-bl-none animate-pulse">
                Thinking and querying your data...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-[16px] bg-[#f8fafc] border-t border-brand-border">
          <form onSubmit={onSubmit} className="flex gap-[12px]">
            <Input 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask for an analysis, filter, or record search..." 
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              <Send size={16} className="mr-2" /> Send
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
