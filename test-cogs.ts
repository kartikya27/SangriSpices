import 'dotenv/config';
import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
      let salesSql = `
        SELECT 
          s.*, 
          v.product_id,
          v.weight_grams,
          v.packaging_cost,
          v.sticker_cost,
          r.total_cost as rm_total_cost,
          r.total_qty_kg,
          r.transport_cost as rm_transport,
          r.operational_cost as rm_operational
        FROM sales s 
        JOIN variants v ON s.variant_id = v.id 
        LEFT JOIN raw_materials r ON v.raw_material_id = r.id
        WHERE 1=1
      `;
  const res = await db.execute(salesSql);
  const salesRows = res.rows;
  
      let totalRevenue = 0, totalCogs = 0;
      let returnedRevenue = 0, returnedCogs = 0;
      
      for(const s of salesRows) {
        const salePrice = Number(s.sale_price) || 0;
        const qty = Number(s.qty) || 0;
        
        let unitCost = Number(s.unit_cost) || 0;
        if (unitCost === 0) {
           const transport = Number(s.rm_transport || 0);
           const operational = Number(s.rm_operational || 0);
           const totalRmCostBasis = Number(s.rm_total_cost || 0) + transport + operational;
           const rm_cost_per_gram = (Number(s.total_qty_kg) > 0 && totalRmCostBasis > 0) ? (totalRmCostBasis / (Number(s.total_qty_kg) * 1000)) : 0;
           const raw_material_cost = rm_cost_per_gram * Number(s.weight_grams || 0);
           unitCost = raw_material_cost + Number(s.packaging_cost || 0) + Number(s.sticker_cost || 0);
        }
        
        const shippingCost = Number(s.shipping_cost) || 0;

        if (s.is_returned === 1) {
          returnedRevenue += (salePrice * qty);
          returnedCogs += (unitCost * qty) + shippingCost;
        } else {
          totalRevenue += (salePrice * qty);
          totalCogs += (unitCost * qty) + shippingCost;
        }
      }
      
  console.log("totalRevenue:", totalRevenue);
  console.log("totalCogs:", totalCogs);
}
run();
