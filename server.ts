import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

import { GoogleGenAI } from "@google/genai";

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Initialize database schema
db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS raw_materials (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    total_qty_kg REAL DEFAULT 0,
    total_cost REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    raw_material_id TEXT,
    name TEXT NOT NULL,
    weight_grams REAL NOT NULL,
    packaging_cost REAL DEFAULT 0,
    sticker_cost REAL DEFAULT 0,
    operational_cost REAL DEFAULT 0,
    transport_cost REAL DEFAULT 0,
    markup_percent REAL DEFAULT 0,
    stock_qty INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(raw_material_id) REFERENCES raw_materials(id)
  );

  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
  );

  INSERT OR IGNORE INTO channels (id, name) VALUES 
    ('local', 'Local Shop'),
    ('website', 'Website'),
    ('amazon', 'Amazon');

  CREATE TABLE IF NOT EXISTS pricing (
    id TEXT PRIMARY KEY,
    variant_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    sale_price REAL DEFAULT 0,
    shipping_cost REAL DEFAULT 0,
    UNIQUE(variant_id, channel_id),
    FOREIGN KEY(variant_id) REFERENCES variants(id),
    FOREIGN KEY(channel_id) REFERENCES channels(id)
  );

  CREATE TABLE IF NOT EXISTS inventory_logs (
    id TEXT PRIMARY KEY,
    variant_id TEXT NOT NULL,
    qty_change INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(variant_id) REFERENCES variants(id)
  );

  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    channel_id TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    qty INTEGER NOT NULL,
    sale_price REAL NOT NULL,
    unit_cost REAL NOT NULL,
    shipping_cost REAL NOT NULL,
    FOREIGN KEY(channel_id) REFERENCES channels(id),
    FOREIGN KEY(variant_id) REFERENCES variants(id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    platform TEXT,
    payment_mode TEXT,
    amount REAL NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_date DATETIME
  );
  CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    campaign_name TEXT,
    start_date DATETIME NOT NULL,
    end_date DATETIME,
    spend REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try { db.exec(`ALTER TABLE raw_materials ADD COLUMN transport_cost REAL DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE raw_materials ADD COLUMN operational_cost REAL DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE expenses ADD COLUMN end_date DATETIME;`); } catch (e) {}
try { db.exec(`ALTER TABLE variants ADD COLUMN mrp REAL DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE sales ADD COLUMN customer_phone TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE sales ADD COLUMN customer_address TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE sales ADD COLUMN order_id TEXT;`); } catch (e) {}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- API ROUTES ---

  // Raw Materials
  app.get('/api/raw-materials', (req, res) => {
    const list = db.prepare('SELECT * FROM raw_materials ORDER BY created_at DESC').all();
    res.json(list.map((rm: any) => {
      const transport = rm.transport_cost || 0;
      const operational = rm.operational_cost || 0;
      const totalCostBasis = rm.total_cost + transport + operational;
      return {
        ...rm,
        cost_per_gram: rm.total_qty_kg > 0 ? (totalCostBasis) / (rm.total_qty_kg * 1000) : 0,
        transport_cost: transport,
        operational_cost: operational
      };
    }));
  });

  app.post('/api/raw-materials', (req, res) => {
    const { id: updateId, name, total_qty_kg, total_cost, transport_cost, operational_cost } = req.body;
    if (updateId) {
      db.prepare('UPDATE raw_materials SET name=?, total_qty_kg=?, total_cost=?, transport_cost=?, operational_cost=? WHERE id=?').run(name, total_qty_kg, total_cost, transport_cost, operational_cost, updateId);
      res.json({ id: updateId });
    } else {
      const id = uuidv4();
      db.prepare('INSERT INTO raw_materials (id, name, total_qty_kg, total_cost, transport_cost, operational_cost) VALUES (?, ?, ?, ?, ?, ?)').run(id, name, total_qty_kg || 0, total_cost || 0, transport_cost || 0, operational_cost || 0);
      res.json({ id });
    }
  });

  app.delete('/api/raw-materials/:id', (req, res) => {
    try {
      const count = db.prepare('SELECT count(*) as c FROM variants WHERE raw_material_id=?').get(req.params.id) as {c: number};
      if (count.c > 0) return res.status(400).json({ error: 'Cannot delete raw material because variants are linked to it.' });
      db.prepare('DELETE FROM raw_materials WHERE id=?').run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Products
  app.get('/api/products', (req, res) => {
    const list = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
    res.json(list);
  });

  app.post('/api/products', (req, res) => {
    const { id: updateId, name, description } = req.body;
    if (updateId) {
      db.prepare('UPDATE products SET name=?, description=? WHERE id=?').run(name, description, updateId);
      res.json({ id: updateId });
    } else {
      const id = uuidv4();
      db.prepare('INSERT INTO products (id, name, description) VALUES (?, ?, ?)').run(id, name, description || '');
      res.json({ id });
    }
  });

  app.delete('/api/products/:id', (req, res) => {
    try {
      const count = db.prepare('SELECT count(*) as c FROM variants WHERE product_id=?').get(req.params.id) as {c: number};
      if (count.c > 0) return res.status(400).json({ error: 'Cannot delete product because it has variants connected to it.' });
      db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/variants/:id', (req, res) => {
    try {
      const count = db.prepare('SELECT count(*) as c FROM sales WHERE variant_id=?').get(req.params.id) as {c: number};
      if (count.c > 0) return res.status(400).json({ error: 'Cannot delete variant because sales are linked to it.' });
      db.prepare('DELETE FROM pricing WHERE variant_id=?').run(req.params.id);
      db.prepare('DELETE FROM inventory_logs WHERE variant_id=?').run(req.params.id);
      db.prepare('DELETE FROM variants WHERE id=?').run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Variants (with computed costs)
  app.get('/api/variants', (req, res) => {
    const list = db.prepare(`
      SELECT v.*, r.name as rm_name, r.total_cost, r.total_qty_kg, r.transport_cost as rm_transport, r.operational_cost as rm_operational, p.name as product_name
      FROM variants v 
      LEFT JOIN raw_materials r ON v.raw_material_id = r.id
      JOIN products p ON v.product_id = p.id
    `).all();
    
    // Compute total cost per unit
    const enriched = list.map((v: any) => {
      const transport = v.rm_transport || 0;
      const operational = v.rm_operational || 0;
      const totalRmCostBasis = (v.total_cost || 0) + transport + operational;
      const rm_cost_per_gram = (v.total_qty_kg > 0 && totalRmCostBasis > 0) ? (totalRmCostBasis / (v.total_qty_kg * 1000)) : 0;
      const raw_material_cost = rm_cost_per_gram * v.weight_grams;
      // Note: we ignore v.operational_cost and v.transport_cost since they are moved to raw materials
      const total_manufacturing_cost = raw_material_cost + v.packaging_cost + v.sticker_cost;
      return { ...v, raw_material_cost, total_manufacturing_cost, rm_cost_per_gram };
    });
    
    res.json(enriched);
  });

  app.post('/api/variants', (req, res) => {
    const { id: updateId, product_id, raw_material_id, name, weight_grams, packaging_cost, sticker_cost, stock_qty } = req.body;
    
    if (updateId) {
      db.prepare(`
        UPDATE variants SET product_id=?, raw_material_id=?, name=?, weight_grams=?, packaging_cost=?, sticker_cost=?, stock_qty=? WHERE id=?
      `).run(product_id, raw_material_id, name, weight_grams, packaging_cost||0, sticker_cost||0, stock_qty||0, updateId);
      return res.json({ id: updateId });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO variants (id, product_id, raw_material_id, name, weight_grams, packaging_cost, sticker_cost, operational_cost, transport_cost, stock_qty)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
    `).run(id, product_id, raw_material_id, name, weight_grams, packaging_cost||0, sticker_cost||0, stock_qty||0);
    res.json({ id });
  });

  app.post('/api/variants/:id/mrp', (req, res) => {
    db.prepare('UPDATE variants SET mrp=? WHERE id=?').run(req.body.mrp, req.params.id);
    res.json({ success: true });
  });

  // Channels & Pricing
  app.get('/api/channels', (req, res) => {
    res.json(db.prepare('SELECT * FROM channels').all());
  });

  app.get('/api/pricing', (req, res) => {
    res.json(db.prepare('SELECT * FROM pricing').all());
  });

  app.post('/api/pricing', (req, res) => {
    const { variant_id, channel_id, sale_price, shipping_cost } = req.body;
    
    // Upsert
    const existing = db.prepare('SELECT id FROM pricing WHERE variant_id=? AND channel_id=?').get(variant_id, channel_id) as { id: string } | undefined;
    
    if (existing) {
      db.prepare('UPDATE pricing SET sale_price=?, shipping_cost=? WHERE id=?').run(sale_price, shipping_cost, existing.id);
    } else {
      db.prepare('INSERT INTO pricing (id, variant_id, channel_id, sale_price, shipping_cost) VALUES (?, ?, ?, ?, ?)').run(uuidv4(), variant_id, channel_id, sale_price, shipping_cost);
    }
    res.json({ success: true });
  });

  // Sales
  app.get('/api/sales', (req, res) => {
    const list = db.prepare(`
      SELECT s.*, v.name as variant_name, p.name as product_name, c.name as channel_name 
      FROM sales s
      JOIN variants v ON s.variant_id = v.id
      JOIN products p ON v.product_id = p.id
      JOIN channels c ON s.channel_id = c.id
      ORDER BY s.date DESC
    `).all();
    res.json(list);
  });

  app.post('/api/sales', (req, res) => {
    const { channel_id, date, customer_phone, customer_address, items } = req.body;
    const finalDate = date || new Date().toISOString();
    const order_id = uuidv4();
    
    if (!items || !items.length) {
      return res.status(400).json({ error: "No items provided" });
    }

    const trx = db.transaction(() => {
      for (const item of items) {
        const id = uuidv4();
        db.prepare('INSERT INTO sales (id, order_id, channel_id, variant_id, qty, sale_price, unit_cost, shipping_cost, date, customer_phone, customer_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, order_id, channel_id, item.variant_id, item.qty, item.sale_price, item.unit_cost, item.shipping_cost, finalDate, customer_phone || null, customer_address || null);
        
        db.prepare('UPDATE variants SET stock_qty = stock_qty - ? WHERE id = ?').run(item.qty, item.variant_id);
        
        db.prepare('INSERT INTO inventory_logs (id, variant_id, qty_change, reason, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(uuidv4(), item.variant_id, -item.qty, 'Sale', finalDate);
      }
    });
    
    trx();
    res.json({ order_id });
  });

  app.delete('/api/sales/:id', (req, res) => {
    db.prepare('DELETE FROM sales WHERE id=?').run(req.params.id);
    res.json({ success: true });
  });

  // Expenses
  app.get('/api/expenses', (req, res) => {
    res.json(db.prepare('SELECT * FROM expenses ORDER BY date DESC').all());
  });

  app.post('/api/expenses', (req, res) => {
    const { id: updateId, category, platform, payment_mode, amount, date, end_date } = req.body;
    if (updateId) {
      db.prepare('UPDATE expenses SET category=?, platform=?, payment_mode=?, amount=?, date=?, end_date=? WHERE id=?')
        .run(category, platform, payment_mode, amount, date || new Date().toISOString(), end_date || null, updateId);
      res.json({ id: updateId });
    } else {
      const id = uuidv4();
      db.prepare('INSERT INTO expenses (id, category, platform, payment_mode, amount, date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, category, platform, payment_mode, amount, date || new Date().toISOString(), end_date || null);
      res.json({ id });
    }
  });

  app.delete('/api/expenses/:id', (req, res) => {
    db.prepare('DELETE FROM expenses WHERE id=?').run(req.params.id);
    res.json({ success: true });
  });

  // Marketing Campaigns
  app.get('/api/marketing', (req, res) => {
    res.json(db.prepare('SELECT * FROM marketing_campaigns ORDER BY start_date DESC').all());
  });

  app.post('/api/marketing', (req, res) => {
    const { id: updateId, platform, campaign_name, start_date, end_date, spend } = req.body;
    if (updateId) {
      db.prepare('UPDATE marketing_campaigns SET platform=?, campaign_name=?, start_date=?, end_date=?, spend=? WHERE id=?')
        .run(platform, campaign_name, start_date, end_date || null, spend, updateId);
      res.json({ id: updateId });
    } else {
      const id = uuidv4();
      db.prepare('INSERT INTO marketing_campaigns (id, platform, campaign_name, start_date, end_date, spend) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, platform, campaign_name, start_date, end_date || null, spend);
      res.json({ id });
    }
  });

  app.delete('/api/marketing/:id', (req, res) => {
    db.prepare('DELETE FROM marketing_campaigns WHERE id=?').run(req.params.id);
    res.json({ success: true });
  });

  // Dashboard Stats
  app.get('/api/dashboard', (req, res) => {
    const { start_date, end_date, product_id } = req.query as { start_date?: string, end_date?: string, product_id?: string };

    let salesQueryStr = 'SELECT s.*, v.product_id FROM sales s JOIN variants v ON s.variant_id = v.id WHERE 1=1';
    const salesParams: any[] = [];
    if (start_date) { salesQueryStr += ' AND s.date >= ?'; salesParams.push(start_date); }
    if (end_date) { salesQueryStr += ' AND s.date <= ?'; salesParams.push(end_date + 'T23:59:59'); }
    if (product_id) { salesQueryStr += ' AND v.product_id = ?'; salesParams.push(product_id); }
    
    const sales = db.prepare(salesQueryStr).all(...salesParams) as any[];

    let expQueryStr = 'SELECT category, amount FROM expenses WHERE 1=1';
    const expParams: any[] = [];
    if (start_date) { expQueryStr += ' AND date >= ?'; expParams.push(start_date); }
    if (end_date) { expQueryStr += ' AND date <= ?'; expParams.push(end_date + 'T23:59:59'); }
    const expensesList = db.prepare(expQueryStr).all(...expParams) as {category: string, amount: number}[];

    let mktQueryStr = 'SELECT spend FROM marketing_campaigns WHERE 1=1';
    const mktParams: any[] = [];
    if (start_date) { mktQueryStr += ' AND start_date >= ?'; mktParams.push(start_date); }
    if (end_date) { mktQueryStr += ' AND start_date <= ?'; mktParams.push(end_date + 'T23:59:59'); }
    const marketingList = db.prepare(mktQueryStr).all(...mktParams) as {spend: number}[];

    const rawMaterials = db.prepare('SELECT COALESCE(SUM(total_cost), 0) as total FROM raw_materials').get() as { total: number };
    
    let totalRevenue = 0;
    let totalCogs = 0;
    
    for(const s of sales) {
      totalRevenue += (s.sale_price * s.qty);
      totalCogs += ((s.unit_cost + s.shipping_cost) * s.qty);
    }
    
    let totalExpenses = 0;
    for(const e of expensesList) {
      totalExpenses += e.amount;
    }

    let marketingSpend = 0;
    for(const m of marketingList) {
      marketingSpend += m.spend;
    }

    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - totalExpenses - marketingSpend;
    const roas = marketingSpend > 0 ? (totalRevenue / marketingSpend) : 0;
    const marketingPercent = totalRevenue > 0 ? (marketingSpend / totalRevenue) * 100 : 0;
    
    res.json({
      totalRevenue,
      totalPurchases: rawMaterials.total,
      totalExpenses: totalExpenses,
      marketingSpend,
      roas,
      marketingPercent,
      grossProfit,
      netProfit,
      salesCount: sales.length
    });
  });

  // AI Chat Filter / Analytics endpoint
  app.post('/api/ai/ask', async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });

      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
        return res.status(400).json({ error: "Please set your actual GEMINI_API_KEY in the Secrets panel (Settings gear icon)." });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // Gather DB snapshot
      const rawMaterials = db.prepare('SELECT * FROM raw_materials').all();
      const products = db.prepare('SELECT * FROM products').all();
      const variants = db.prepare('SELECT * FROM variants').all();
      const sales = db.prepare('SELECT * FROM sales').all();
      const channels = db.prepare('SELECT * FROM channels').all();
      const expenses = db.prepare('SELECT * FROM expenses').all();
      const marketing = db.prepare('SELECT * FROM marketing_campaigns').all();

      const dbSnapshot = {
        rawMaterials, products, variants, sales, channels, expenses, marketing
      };

      const systemPrompt = `You are the AI assistant for SpiceOS, a business management app for a spice business.
The user is asking you to filter data, answer a question, or provide analytics. 
Here is a complete JSON snapshot of their current active database:
${JSON.stringify(dbSnapshot)}

Answer the user's prompt using ONLY this data. Format your response clearly in Markdown. Use tables for filtered lists. Be concise, act purely as an analytics and data filter tool.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          systemInstruction: systemPrompt
        }
      });

      res.json({ result: response.text });
    } catch (e: any) {
      console.error(e);
      if (e.message && e.message.includes("API key not valid")) {
         return res.status(400).json({ error: "Invalid Gemini API Key. Please update it in the Secrets panel via the Settings menu." });
      }
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
