import { Response } from "express";
import { pool } from "../db";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

/**
 * Obtener todos los egresos/gastos
 * GET /api/finance/expenses
 */
export const getExpenses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const query = `
      SELECT e.id, e.expense_number, e.category, e.description, e.amount, e.payment_method, e.created_at,
             u.name as registered_by_name
      FROM finance.expenses e
      LEFT JOIN auth.users u ON u.id = e.registered_by
      ORDER BY e.created_at DESC;
    `;
        const result = await pool.query(query);

        const expenses = result.rows.map((row) => ({
            id: row.id,
            expenseNumber: row.expense_number,
            category: row.category,
            description: row.description,
            amount: parseFloat(row.amount),
            paymentMethod: row.payment_method,
            registeredByName: row.registered_by_name || "Sistema",
            createdAt: row.created_at
        }));

        res.status(200).json(expenses);
    } catch (error: any) {
        console.error("Error al obtener gastos:", error);
        res.status(500).json({ message: "Error interno al consultar gastos." });
    }
};

/**
 * Registrar un nuevo gasto o egreso
 * POST /api/finance/expenses
 */
export const createExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { category, description, amount, paymentMethod } = req.body;

    const expAmount = parseFloat(amount);
    if (!category || !description || isNaN(expAmount) || expAmount <= 0) {
        res.status(400).json({ message: "Categoría, descripción y un monto válido son obligatorios." });
        return;
    }

    try {
        const seqRes = await pool.query("SELECT nextval('finance.seq_expense_number') as num");
        const expenseNumber = `G-${seqRes.rows[0].num}`;

        const insertQuery = `
      INSERT INTO finance.expenses (expense_number, category, description, amount, payment_method, registered_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
        const result = await pool.query(insertQuery, [
            expenseNumber,
            category,
            description.trim(),
            expAmount,
            paymentMethod || "CASH",
            req.user?.id || null
        ]);

        const row = result.rows[0];
        res.status(201).json({
            message: "Gasto registrado exitosamente",
            expense: {
                id: row.id,
                expenseNumber: row.expense_number,
                category: row.category,
                description: row.description,
                amount: parseFloat(row.amount),
                paymentMethod: row.payment_method,
                createdAt: row.created_at
            }
        });
    } catch (error: any) {
        console.error("Error al crear gasto:", error);
        res.status(500).json({ message: "Error al guardar el gasto." });
    }
};

/**
 * Realizar Arqueo y Cierre de Caja
 * POST /api/finance/cash-closures
 */
export const createCashClosure = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { countedCash, countedCard, countedElectronic, openingBalance, observations, openedAt } = req.body;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Calcular ventas realizadas desde la última apertura o inicio del día
        const startTime = openedAt ? new Date(openedAt) : new Date(new Date().setHours(0, 0, 0, 0));

        const salesSummaryRes = await client.query(
            `SELECT 
         COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total ELSE 0 END), 0) as cash_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'CARD' THEN total ELSE 0 END), 0) as card_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'NEQUI_DAVIPLATA' THEN total ELSE 0 END), 0) as electronic_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'CREDIT' THEN total ELSE 0 END), 0) as credit_sales,
         COALESCE(SUM(total), 0) as total_sales
       FROM sales.invoices
       WHERE status = 'PAID' AND created_at >= $1;`,
            [startTime]
        );

        const salesData = salesSummaryRes.rows[0];
        const cashSales = parseFloat(salesData.cash_sales);
        const cardSales = parseFloat(salesData.card_sales);
        const electronicSales = parseFloat(salesData.electronic_sales);
        const creditSales = parseFloat(salesData.credit_sales);
        const totalSales = parseFloat(salesData.total_sales);

        // Calcular egresos en efectivo
        const expRes = await client.query(
            `SELECT COALESCE(SUM(amount), 0) as cash_expenses FROM finance.expenses WHERE payment_method = 'CASH' AND created_at >= $1;`,
            [startTime]
        );
        const cashExpenses = parseFloat(expRes.rows[0].cash_expenses);

        const initBalance = parseFloat(openingBalance || 0);
        const expectedCash = initBalance + cashSales - cashExpenses;

        const cntCash = parseFloat(countedCash || 0);
        const cntCard = parseFloat(countedCard || 0);
        const cntElec = parseFloat(countedElectronic || 0);
        const discrepancy = cntCash - expectedCash;

        const closureNum = `CLO-${Date.now().toString().slice(-8)}`;

        const insertQuery = `
      INSERT INTO finance.cash_register_closures
        (closure_number, closed_by, opened_at, opening_balance, cash_sales, card_sales, electronic_sales, credit_sales, total_sales, cash_expenses, expected_cash, counted_cash, counted_card, counted_electronic, cash_discrepancy, observations)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *;
    `;

        // Si req.user?.id no es un id válido en auth.users, traemos el primer admin
        let validUserId = req.user?.id;
        const checkUser = await client.query("SELECT id FROM auth.users WHERE id = $1", [validUserId]);
        if (checkUser.rows.length === 0) {
            const adminUser = await client.query("SELECT id FROM auth.users LIMIT 1");
            validUserId = adminUser.rows[0].id;
        }

        const result = await client.query(insertQuery, [
            closureNum,
            validUserId,
            startTime,
            initBalance,
            cashSales,
            cardSales,
            electronicSales,
            creditSales,
            totalSales,
            cashExpenses,
            expectedCash,
            cntCash,
            cntCard,
            cntElec,
            discrepancy,
            observations || ""
        ]);

        await client.query("COMMIT");

        res.status(201).json({
            message: "Cierre de caja generado con éxito",
            closure: result.rows[0]
        });
    } catch (error: any) {
        await client.query("ROLLBACK");
        console.error("Error al generar cierre de caja:", error);
        res.status(500).json({ message: "Error al guardar el arqueo de caja." });
    } finally {
        client.release();
    }
};

/**
 * Obtener listado de cierres de caja anteriores
 * GET /api/finance/cash-closures
 */
export const getCashClosures = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const query = `
      SELECT c.*, u.name as closed_by_name
      FROM finance.cash_register_closures c
      JOIN auth.users u ON u.id = c.closed_by
      ORDER BY c.closed_at DESC;
    `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error: any) {
        console.error("Error al consultar cierres de caja:", error);
        res.status(500).json({ message: "Error interno al recuperar los cierres." });
    }
};

/**
 * Obtener Auditoría General / Audit Trail
 * GET /api/audit-logs
 */
export const getAuditLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const query = `
      SELECT id, audit_code, user_name, user_role, category, severity, action, entity_name, details, created_at
      FROM audit.audit_trail
      ORDER BY created_at DESC
      LIMIT 100;
    `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error: any) {
        console.error("Error al consultar audit logs:", error);
        res.status(500).json({ message: "Error al recuperar registros de auditoría." });
    }
};
