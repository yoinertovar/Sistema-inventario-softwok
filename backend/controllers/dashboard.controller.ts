import { Response } from "express";
import { pool } from "../db";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

/**
 * Métricas del Dashboard Principal (Resumen Ejecutivo en Tiempo Real)
 * GET /api/dashboard/summary
 */
export const getDashboardSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const today = new Date().toISOString().split("T")[0];

        // Ventas de hoy
        const todaySalesQuery = `
      SELECT COALESCE(COUNT(*), 0) as count, COALESCE(SUM(total), 0) as total
      FROM sales.invoices
      WHERE status = 'PAID' AND DATE(created_at AT TIME ZONE 'America/Bogota') = $1;
    `;
        const todaySalesRes = await pool.query(todaySalesQuery, [today]);

        // Productos y stock bajo
        const productsRes = await pool.query(`
      SELECT 
        COUNT(*) as total_products,
        COALESCE(SUM(CASE WHEN stock <= min_stock THEN 1 ELSE 0 END), 0) as low_stock_count
      FROM inventory.products
      WHERE active = true;
    `);

        // Clientes y saldo de crédito total
        const clientsRes = await pool.query(`
      SELECT 
        COUNT(*) as total_clients,
        COALESCE(SUM(credit_balance), 0) as total_credit_balance
      FROM sales.clients
      WHERE active = true;
    `);

        // Gastos de hoy
        const todayExpensesRes = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM finance.expenses
      WHERE DATE(created_at AT TIME ZONE 'America/Bogota') = $1;
    `, [today]);

        // Productos más vendidos (Top 5)
        const topProductsRes = await pool.query(`
      SELECT ii.product_name, SUM(ii.quantity) as total_qty, SUM(ii.line_total) as total_revenue
      FROM sales.invoice_items ii
      JOIN sales.invoices i ON i.id = ii.invoice_id
      WHERE i.status = 'PAID'
      GROUP BY ii.product_name
      ORDER BY total_qty DESC
      LIMIT 5;
    `);

        res.status(200).json({
            todaySalesCount: parseInt(todaySalesRes.rows[0].count, 10),
            todaySalesTotal: parseFloat(todaySalesRes.rows[0].total),
            totalProducts: parseInt(productsRes.rows[0].total_products, 10),
            lowStockCount: parseInt(productsRes.rows[0].low_stock_count, 10),
            totalClients: parseInt(clientsRes.rows[0].total_clients, 10),
            totalCreditBalance: parseFloat(clientsRes.rows[0].total_credit_balance),
            todayExpensesTotal: parseFloat(todayExpensesRes.rows[0].total),
            topSellingProducts: topProductsRes.rows.map(r => ({
                productName: r.product_name,
                quantity: parseInt(r.total_qty, 10),
                revenue: parseFloat(r.total_revenue)
            }))
        });
    } catch (error: any) {
        console.error("Error al obtener resumen del dashboard:", error);
        res.status(500).json({ message: "Error al recuperar métricas del dashboard." });
    }
};
