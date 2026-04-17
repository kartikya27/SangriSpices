import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@libsql/client';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import Groq from 'groq-sdk';

import { GoogleGenAI } from "@google/genai";

// Use Turso if credentials are provided, otherwise fallback to local sqlite
const rawUrl = process.env.TURSO_DATABASE_URL || '';
const dbAuthToken = process.env.TURSO_AUTH_TOKEN?.trim();

// Very basic cleanup in case of accidentally swapped fields or copy-paste artifacts
let dbUrl = rawUrl.trim();
if (dbUrl.includes(' ') && !dbUrl.startsWith('file:')) {
  // If there's a space, it might be a combo or a label. Try to extract just the URL part
  const match = dbUrl.match(/(libsql|https?):\/\/[^\s]+/);
  if (match) dbUrl = match[0];
}

if (!dbUrl) {
  dbUrl = 'file:database.sqlite';
}

console.log('Database URL configured:', dbUrl.startsWith('libsql') ? 'Turso' : dbUrl);
if (dbAuthToken) console.log('Auth Token: Found');

const db = createClient({
  url: dbUrl,
  authToken: dbAuthToken,
});

async function initializeDatabase() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS raw_materials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'Spice',
      unit TEXT DEFAULT 'kg',
      total_qty_kg REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      transport_cost REAL DEFAULT 0,
      operational_cost REAL DEFAULT 0,
      is_depleted INTEGER DEFAULT 0
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
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
      mrp REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id),
      FOREIGN KEY(raw_material_id) REFERENCES raw_materials(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );
  `);

  await db.execute("INSERT OR IGNORE INTO channels (id, name) VALUES ('local', 'Local Shop'), ('website', 'Website'), ('amazon', 'Amazon');");

  await db.execute(`
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
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS inventory_logs (
      id TEXT PRIMARY KEY,
      variant_id TEXT NOT NULL,
      qty_change INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(variant_id) REFERENCES variants(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      channel_id TEXT NOT NULL,
      variant_id TEXT NOT NULL,
      qty INTEGER NOT NULL,
      sale_price REAL NOT NULL,
      unit_cost REAL NOT NULL,
      shipping_cost REAL NOT NULL,
      customer_phone TEXT,
      customer_address TEXT,
      order_id TEXT,
      FOREIGN KEY(channel_id) REFERENCES channels(id),
      FOREIGN KEY(variant_id) REFERENCES variants(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      platform TEXT,
      payment_mode TEXT,
      amount REAL NOT NULL,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_date DATETIME
    );
  `);

  await db.execute(`
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

  // Migrations / Catch-all for missing columns
  const migrations = [
    "ALTER TABLE raw_materials ADD COLUMN unit TEXT DEFAULT 'kg'",
    "ALTER TABLE raw_materials ADD COLUMN category TEXT DEFAULT 'Spice'",
    "ALTER TABLE raw_materials ADD COLUMN transport_cost REAL DEFAULT 0",
    "ALTER TABLE raw_materials ADD COLUMN operational_cost REAL DEFAULT 0",
    "ALTER TABLE raw_materials ADD COLUMN is_depleted INTEGER DEFAULT 0",
    "ALTER TABLE variants ADD COLUMN mrp REAL DEFAULT 0",
    "ALTER TABLE expenses ADD COLUMN end_date DATETIME",
    "ALTER TABLE sales ADD COLUMN customer_phone TEXT",
    "ALTER TABLE sales ADD COLUMN customer_address TEXT",
    "ALTER TABLE sales ADD COLUMN order_id TEXT"
  ];

  for (const m of migrations) {
    try { await db.execute(m); } catch (e) {}
  }
}

async function startServer() {
  await initializeDatabase();
  
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- API ROUTES ---

  // Raw Materials
  app.post('/api/raw-materials/:id/deplete', async (req, res) => {
    const { is_depleted } = req.body;
    await db.execute({
      sql: 'UPDATE raw_materials SET is_depleted=? WHERE id=?',
      args: [is_depleted ? 1 : 0, req.params.id]
    });
    res.json({ success: true });
  });

  app.get('/api/raw-materials', async (req, res) => {
    const result = await db.execute('SELECT * FROM raw_materials ORDER BY created_at DESC');
    const materials = result.rows.map((rm: any) => {
      const transport = Number(rm.transport_cost || 0);
      const operational = Number(rm.operational_cost || 0);
      const totalCostBasis = Number(rm.total_cost || 0) + transport + operational;
      const qty = Number(rm.total_qty_kg || 0);
      return {
        ...rm,
        cost_per_unit: qty > 0 ? (totalCostBasis) / qty : 0,
        // legacy compat
        cost_per_gram: rm.unit === 'kg' ? (qty > 0 ? totalCostBasis / (qty * 1000) : 0) : (qty > 0 ? totalCostBasis / qty : 0),
        transport_cost: transport,
        operational_cost: operational
      };
    });
    res.json(materials);
  });

  app.post('/api/raw-materials', async (req, res) => {
    const { id: updateId, name, category, unit, total_qty_kg, total_cost, transport_cost, operational_cost } = req.body;
    if (updateId) {
      await db.execute({
        sql: 'UPDATE raw_materials SET name=?, category=?, unit=?, total_qty_kg=?, total_cost=?, transport_cost=?, operational_cost=? WHERE id=?',
        args: [name, category || 'Spice', unit || 'kg', total_qty_kg, total_cost, transport_cost, operational_cost, updateId]
      });
      res.json({ id: updateId });
    } else {
      const id = uuidv4();
      await db.execute({
        sql: 'INSERT INTO raw_materials (id, name, category, unit, total_qty_kg, total_cost, transport_cost, operational_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [id, name, category || 'Spice', unit || 'kg', total_qty_kg || 0, total_cost || 0, transport_cost || 0, operational_cost || 0]
      });
      res.json({ id });
    }
  });

  app.delete('/api/raw-materials/:id', async (req, res) => {
    try {
      const result = await db.execute({
        sql: 'SELECT count(*) as c FROM variants WHERE raw_material_id=?',
        args: [req.params.id]
      });
      if (Number(result.rows[0].c) > 0) return res.status(400).json({ error: 'Cannot delete raw material because variants are linked to it.' });
      await db.execute({
        sql: 'DELETE FROM raw_materials WHERE id=?',
        args: [req.params.id]
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Products
  app.get('/api/products', async (req, res) => {
    const result = await db.execute('SELECT * FROM products ORDER BY created_at DESC');
    res.json(result.rows);
  });

  app.post('/api/products', async (req, res) => {
    const { id: updateId, name, description } = req.body;
    if (updateId) {
      await db.execute({
        sql: 'UPDATE products SET name=?, description=? WHERE id=?',
        args: [name, description, updateId]
      });
      res.json({ id: updateId });
    } else {
      const id = uuidv4();
      await db.execute({
        sql: 'INSERT INTO products (id, name, description) VALUES (?, ?, ?)',
        args: [id, name, description || '']
      });
      res.json({ id });
    }
  });

  app.delete('/api/products/:id', async (req, res) => {
    try {
      const result = await db.execute({
        sql: 'SELECT count(*) as c FROM variants WHERE product_id=?',
        args: [req.params.id]
      });
      if (Number(result.rows[0].c) > 0) return res.status(400).json({ error: 'Cannot delete product because it has variants connected to it.' });
      await db.execute({
        sql: 'DELETE FROM products WHERE id=?',
        args: [req.params.id]
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/variants/:id', async (req, res) => {
    try {
      const result = await db.execute({
        sql: 'SELECT count(*) as c FROM sales WHERE variant_id=?',
        args: [req.params.id]
      });
      if (Number(result.rows[0].c) > 0) return res.status(400).json({ error: 'Cannot delete variant because sales are linked to it.' });
      
      await db.batch([
        { sql: 'DELETE FROM pricing WHERE variant_id=?', args: [req.params.id] },
        { sql: 'DELETE FROM inventory_logs WHERE variant_id=?', args: [req.params.id] },
        { sql: 'DELETE FROM variants WHERE id=?', args: [req.params.id] }
      ], 'write');
      
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Variants
  app.get('/api/variants', async (req, res) => {
    const result = await db.execute(`
      SELECT v.*, r.name as rm_name, r.total_cost, r.total_qty_kg, r.transport_cost as rm_transport, r.operational_cost as rm_operational, p.name as product_name
      FROM variants v 
      LEFT JOIN raw_materials r ON v.raw_material_id = r.id
      JOIN products p ON v.product_id = p.id
    `);
    
    const enriched = result.rows.map((v: any) => {
      const transport = Number(v.rm_transport || 0);
      const operational = Number(v.rm_operational || 0);
      const totalRmCostBasis = Number(v.total_cost || 0) + transport + operational;
      const rm_cost_per_gram = (v.total_qty_kg > 0 && totalRmCostBasis > 0) ? (totalRmCostBasis / (v.total_qty_kg * 1000)) : 0;
      const raw_material_cost = rm_cost_per_gram * v.weight_grams;
      const total_manufacturing_cost = raw_material_cost + Number(v.packaging_cost || 0) + Number(v.sticker_cost || 0);
      return { ...v, raw_material_cost, total_manufacturing_cost, rm_cost_per_gram };
    });
    
    res.json(enriched);
  });

  app.post('/api/variants', async (req, res) => {
    const { id: updateId, product_id, raw_material_id, name, weight_grams, packaging_cost, sticker_cost, stock_qty } = req.body;
    
    if (updateId) {
      await db.execute({
        sql: 'UPDATE variants SET product_id=?, raw_material_id=?, name=?, weight_grams=?, packaging_cost=?, sticker_cost=?, stock_qty=? WHERE id=?',
        args: [product_id, raw_material_id, name, weight_grams, packaging_cost||0, sticker_cost||0, stock_qty||0, updateId]
      });
      return res.json({ id: updateId });
    }

    const id = uuidv4();
    await db.execute({
      sql: 'INSERT INTO variants (id, product_id, raw_material_id, name, weight_grams, packaging_cost, sticker_cost, operational_cost, transport_cost, stock_qty) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)',
      args: [id, product_id, raw_material_id, name, weight_grams, packaging_cost||0, sticker_cost||0, stock_qty||0]
    });
    res.json({ id });
  });

  app.post('/api/variants/:id/mrp', async (req, res) => {
    await db.execute({
      sql: 'UPDATE variants SET mrp=? WHERE id=?',
      args: [req.body.mrp, req.params.id]
    });
    res.json({ success: true });
  });

  // Channels & Pricing
  app.get('/api/channels', async (req, res) => {
    const result = await db.execute('SELECT * FROM channels');
    res.json(result.rows);
  });

  app.get('/api/pricing', async (req, res) => {
    const result = await db.execute('SELECT * FROM pricing');
    res.json(result.rows);
  });

  app.post('/api/pricing', async (req, res) => {
    const { variant_id, channel_id, sale_price, shipping_cost } = req.body;
    const existingResult = await db.execute({
      sql: 'SELECT id FROM pricing WHERE variant_id=? AND channel_id=?',
      args: [variant_id, channel_id]
    });
    const existing = existingResult.rows[0];
    
    if (existing) {
      await db.execute({
        sql: 'UPDATE pricing SET sale_price=?, shipping_cost=? WHERE id=?',
        args: [sale_price, shipping_cost, existing.id]
      });
    } else {
      await db.execute({
        sql: 'INSERT INTO pricing (id, variant_id, channel_id, sale_price, shipping_cost) VALUES (?, ?, ?, ?, ?)',
        args: [uuidv4(), variant_id, channel_id, sale_price, shipping_cost]
      });
    }
    res.json({ success: true });
  });

  // Sales
  app.get('/api/sales', async (req, res) => {
    const result = await db.execute(`
      SELECT s.*, v.name as variant_name, p.name as product_name, c.name as channel_name 
      FROM sales s
      JOIN variants v ON s.variant_id = v.id
      JOIN products p ON v.product_id = p.id
      JOIN channels c ON s.channel_id = c.id
      ORDER BY s.date DESC
    `);
    res.json(result.rows);
  });

  app.post('/api/sales', async (req, res) => {
    const { channel_id, date, customer_phone, customer_address, items } = req.body;
    const finalDate = date || new Date().toISOString();
    const order_id = uuidv4();
    
    if (!items || !items.length) return res.status(400).json({ error: "No items provided" });

    const batch = [];
    for (const item of items) {
      const id = uuidv4();
      batch.push({
        sql: 'INSERT INTO sales (id, order_id, channel_id, variant_id, qty, sale_price, unit_cost, shipping_cost, date, customer_phone, customer_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [id, order_id, channel_id, item.variant_id, item.qty, item.sale_price, item.unit_cost, item.shipping_cost, finalDate, customer_phone || null, customer_address || null]
      });
      batch.push({
        sql: 'UPDATE variants SET stock_qty = stock_qty - ? WHERE id = ?',
        args: [item.qty, item.variant_id]
      });
      batch.push({
        sql: 'INSERT INTO inventory_logs (id, variant_id, qty_change, reason, created_at) VALUES (?, ?, ?, ?, ?)',
        args: [uuidv4(), item.variant_id, -item.qty, 'Sale', finalDate]
      });
    }
    
    await db.batch(batch, 'write');
    res.json({ order_id });
  });

  app.delete('/api/sales/:id', async (req, res) => {
    await db.execute({ sql: 'DELETE FROM sales WHERE id=?', args: [req.params.id] });
    res.json({ success: true });
  });

  // Expenses
  app.get('/api/expenses', async (req, res) => {
    const result = await db.execute('SELECT * FROM expenses ORDER BY date DESC');
    res.json(result.rows);
  });

  app.post('/api/expenses', async (req, res) => {
    const { id: updateId, category, platform, payment_mode, amount, date, end_date } = req.body;
    if (updateId) {
      await db.execute({
        sql: 'UPDATE expenses SET category=?, platform=?, payment_mode=?, amount=?, date=?, end_date=? WHERE id=?',
        args: [category, platform, payment_mode, amount, date || new Date().toISOString(), end_date || null, updateId]
      });
      res.json({ id: updateId });
    } else {
      const id = uuidv4();
      await db.execute({
        sql: 'INSERT INTO expenses (id, category, platform, payment_mode, amount, date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [id, category, platform, payment_mode, amount, date || new Date().toISOString(), end_date || null]
      });
      res.json({ id });
    }
  });

  app.delete('/api/expenses/:id', async (req, res) => {
    await db.execute({ sql: 'DELETE FROM expenses WHERE id=?', args: [req.params.id] });
    res.json({ success: true });
  });

  // Marketing
  app.get('/api/marketing', async (req, res) => {
    const result = await db.execute('SELECT * FROM marketing_campaigns ORDER BY start_date DESC');
    res.json(result.rows);
  });

  app.post('/api/marketing', async (req, res) => {
    const { id: updateId, platform, campaign_name, start_date, end_date, spend } = req.body;
    if (updateId) {
      await db.execute({
        sql: 'UPDATE marketing_campaigns SET platform=?, campaign_name=?, start_date=?, end_date=?, spend=? WHERE id=?',
        args: [platform, campaign_name, start_date, end_date || null, spend, updateId]
      });
      res.json({ id: updateId });
    } else {
      const id = uuidv4();
      await db.execute({
        sql: 'INSERT INTO marketing_campaigns (id, platform, campaign_name, start_date, end_date, spend) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, platform, campaign_name, start_date, end_date || null, spend]
      });
      res.json({ id });
    }
  });

  app.delete('/api/marketing/:id', async (req, res) => {
    await db.execute({ sql: 'DELETE FROM marketing_campaigns WHERE id=?', args: [req.params.id] });
    res.json({ success: true });
  });

  // Dashboard
  app.get('/api/dashboard', async (req, res) => {
    try {
      const { start_date, end_date, product_id } = req.query as { start_date?: string, end_date?: string, product_id?: string };

      let salesSql = 'SELECT s.*, v.product_id FROM sales s JOIN variants v ON s.variant_id = v.id WHERE 1=1';
      const salesArgs: any[] = [];
      if (start_date) { salesSql += ' AND s.date >= ?'; salesArgs.push(start_date); }
      if (end_date) { salesSql += ' AND s.date <= ?'; salesArgs.push(end_date + 'T23:59:59'); }
      if (product_id) { salesSql += ' AND v.product_id = ?'; salesArgs.push(product_id); }

      let expSql = 'SELECT category, amount FROM expenses WHERE 1=1';
      const expArgs: any[] = [];
      if (start_date) { expSql += ' AND date >= ?'; expArgs.push(start_date); }
      if (end_date) { expSql += ' AND date <= ?'; expArgs.push(end_date + 'T23:59:59'); }

      let mktSql = 'SELECT spend FROM marketing_campaigns WHERE 1=1';
      const mktArgs: any[] = [];
      if (start_date) { mktSql += ' AND start_date >= ?'; mktArgs.push(start_date); }
      if (end_date) { mktSql += ' AND start_date <= ?'; mktArgs.push(end_date + 'T23:59:59'); }

      // Performance: Use batch to get all stats in one round trip
      const batchResult = await db.batch([
        { sql: salesSql, args: salesArgs },
        { sql: expSql, args: expArgs },
        { sql: mktSql, args: mktArgs },
        { sql: 'SELECT COALESCE(SUM(total_cost), 0) as total FROM raw_materials', args: [] }
      ], 'read');

      const salesRows = batchResult[0].rows;
      const expRows = batchResult[1].rows;
      const mktRows = batchResult[2].rows;
      const rawTotal = Number(batchResult[3].rows[0].total);
      
      let totalRevenue = 0, totalCogs = 0;
      for(const s of salesRows) {
        totalRevenue += (Number(s.sale_price) * Number(s.qty));
        totalCogs += ((Number(s.unit_cost) + Number(s.shipping_cost)) * Number(s.qty));
      }
      
      let totalExpenses = 0;
      for(const e of expRows) totalExpenses += Number(e.amount);

      let marketingSpend = 0;
      for(const m of mktRows) marketingSpend += Number(m.spend);

      const grossProfit = totalRevenue - totalCogs;
      const netProfit = grossProfit - totalExpenses - marketingSpend;
      
      res.json({
        totalRevenue,
        totalPurchases: rawTotal,
        totalExpenses,
        marketingSpend,
        roas: marketingSpend > 0 ? (totalRevenue / marketingSpend) : 0,
        marketingPercent: totalRevenue > 0 ? (marketingSpend / totalRevenue) * 100 : 0,
        grossProfit,
        netProfit,
        salesCount: salesRows.length
      });
    } catch (error: any) {
      console.error('Dashboard Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Chat
  app.post('/api/ai/ask', async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });
      
      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) {
        return res.status(400).json({ error: "Please set your GROQ_API_KEY in the Secrets panel." });
      }

      const groq = new Groq({ apiKey: groqKey });

      // Gather DB snapshots in one batch for speed
      const snapBatch = await db.batch([
        { sql: 'SELECT * FROM raw_materials', args: [] },
        { sql: 'SELECT * FROM products', args: [] },
        { sql: 'SELECT * FROM variants', args: [] },
        { sql: 'SELECT * FROM sales', args: [] },
        { sql: 'SELECT * FROM channels', args: [] },
        { sql: 'SELECT * FROM expenses', args: [] },
        { sql: 'SELECT * FROM marketing_campaigns', args: [] }
      ], 'read');

      const dbSnapshot = {
        rawMaterials: snapBatch[0].rows,
        products: snapBatch[1].rows,
        variants: snapBatch[2].rows,
        sales: snapBatch[3].rows,
        channels: snapBatch[4].rows,
        expenses: snapBatch[5].rows,
        marketing: snapBatch[6].rows
      };

      const systemPrompt = `You are the AI assistant for SpiceOS business management. Here is a snapshot of the business data: ${JSON.stringify(dbSnapshot)}. Respond concisely in Markdown. Use tables for lists. Act as an analytics and filtering tool.`;

      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
      });

      res.json({ result: response.choices[0].message.content });
    } catch (e: any) {
      console.error('AI Error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Vite
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}

startServer();
