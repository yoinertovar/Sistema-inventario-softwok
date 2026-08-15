import { Response } from "express";
import { pool } from "../db";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

/**
 * Obtener todos los clientes
 * GET /api/clients
 */
export const getClients = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const query = `
      SELECT id, name, nit_or_cc, phone, email, address, credit_limit, credit_balance, active, is_default, created_at
      FROM sales.clients
      WHERE active = true
      ORDER BY is_default DESC, name ASC;
    `;
        const result = await pool.query(query);

        const clients = result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            nitOrCc: row.nit_or_cc,
            phone: row.phone || "",
            email: row.email || "",
            address: row.address || "",
            creditLimit: parseFloat(row.credit_limit || 0),
            creditBalance: parseFloat(row.credit_balance || 0),
            active: row.active,
            isDefault: row.is_default,
            createdAt: row.created_at
        }));

        res.status(200).json(clients);
    } catch (error: any) {
        console.error("Error al obtener clientes:", error);
        res.status(500).json({ message: "Error interno al consultar la lista de clientes." });
    }
};

/**
 * Registrar un nuevo cliente
 * POST /api/clients
 */
export const createClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { name, nitOrCc, phone, email, address, creditLimit } = req.body;

    if (!name || !nitOrCc) {
        res.status(400).json({ message: "El nombre y la cédula/NIT son obligatorios." });
        return;
    }

    try {
        const insertQuery = `
      INSERT INTO sales.clients (name, nit_or_cc, phone, email, address, credit_limit)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

        const result = await pool.query(insertQuery, [
            name.trim(),
            nitOrCc.trim(),
            phone || "",
            email || null,
            address || "",
            parseFloat(creditLimit || 0)
        ]);

        const row = result.rows[0];
        res.status(201).json({
            message: "Cliente registrado con éxito",
            client: {
                id: row.id,
                name: row.name,
                nitOrCc: row.nit_or_cc,
                phone: row.phone || "",
                email: row.email || "",
                address: row.address || "",
                creditLimit: parseFloat(row.credit_limit),
                creditBalance: parseFloat(row.credit_balance),
                active: row.active,
                isDefault: row.is_default
            }
        });
    } catch (error: any) {
        console.error("Error al crear cliente:", error);
        res.status(500).json({ message: "Error al registrar el cliente. Es posible que el NIT/Cédula ya exista." });
    }
};

/**
 * Actualizar información de cliente o cupo de crédito
 * PUT /api/clients/:id
 */
export const updateClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name, nitOrCc, phone, email, address, creditLimit, active } = req.body;

    try {
        const updateQuery = `
      UPDATE sales.clients
      SET name = COALESCE($1, name),
          nit_or_cc = COALESCE($2, nit_or_cc),
          phone = COALESCE($3, phone),
          email = COALESCE($4, email),
          address = COALESCE($5, address),
          credit_limit = COALESCE($6, credit_limit),
          active = COALESCE($7, active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *;
    `;

        const result = await pool.query(updateQuery, [name, nitOrCc, phone, email, address, creditLimit, active, id]);

        if (result.rows.length === 0) {
            res.status(404).json({ message: "Cliente no encontrado." });
            return;
        }

        const row = result.rows[0];
        res.status(200).json({
            message: "Cliente actualizado correctamente",
            client: {
                id: row.id,
                name: row.name,
                nitOrCc: row.nit_or_cc,
                phone: row.phone || "",
                email: row.email || "",
                address: row.address || "",
                creditLimit: parseFloat(row.credit_limit),
                creditBalance: parseFloat(row.credit_balance),
                active: row.active,
                isDefault: row.is_default
            }
        });
    } catch (error: any) {
        console.error("Error al actualizar cliente:", error);
        res.status(500).json({ message: "Error interno al actualizar cliente." });
    }
};

/**
 * Registrar un abono a la cuenta de crédito de un cliente
 * POST /api/clients/:id/credit-payment
 */
export const processCreditPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { amount, paymentMethod, notes } = req.body;

    const paymentAmt = parseFloat(amount);
    if (isNaN(paymentAmt) || paymentAmt <= 0) {
        res.status(400).json({ message: "El monto del abono debe ser mayor a cero." });
        return;
    }

    const clientDB = await pool.connect();
    try {
        await clientDB.query("BEGIN");

        const clientRes = await clientDB.query("SELECT id, name, credit_balance FROM sales.clients WHERE id = $1 FOR UPDATE", [id]);
        if (clientRes.rows.length === 0) {
            await clientDB.query("ROLLBACK");
            res.status(404).json({ message: "Cliente no encontrado." });
            return;
        }

        const currentBalance = parseFloat(clientRes.rows[0].credit_balance || 0);
        if (paymentAmt > currentBalance) {
            await clientDB.query("ROLLBACK");
            res.status(400).json({
                message: `El monto del abono ($${paymentAmt.toLocaleString()}) supera la deuda actual del cliente ($${currentBalance.toLocaleString()}).`
            });
            return;
        }

        const newBalance = currentBalance - paymentAmt;

        // Actualizar saldo de deuda en el cliente
        await clientDB.query("UPDATE sales.clients SET credit_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [newBalance, id]);

        // Insertar registro contable de abono en finance.credit_payments
        await clientDB.query(
            `INSERT INTO finance.credit_payments
        (client_id, amount, payment_method, previous_balance, new_balance, received_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, paymentAmt, paymentMethod || "CASH", currentBalance, newBalance, req.user?.id || null, notes || "Abono a crédito"]
        );

        await clientDB.query("COMMIT");

        res.status(200).json({
            message: "Abono a crédito procesado con éxito",
            previousBalance: currentBalance,
            amountPaid: paymentAmt,
            newBalance
        });
    } catch (error: any) {
        await clientDB.query("ROLLBACK");
        console.error("Error al procesar abono de crédito:", error);
        res.status(500).json({ message: "Error interno al procesar el abono a crédito." });
    } finally {
        clientDB.release();
    }
};

/**
 * Obtener historial de abonos de un cliente
 * GET /api/clients/:id/credit-history
 */
export const getClientCreditHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const query = `
      SELECT cp.id, cp.amount, cp.payment_method, cp.previous_balance, cp.new_balance, cp.notes, cp.created_at,
             u.name as received_by_name
      FROM finance.credit_payments cp
      LEFT JOIN auth.users u ON u.id = cp.received_by
      WHERE cp.client_id = $1
      ORDER BY cp.created_at DESC;
    `;
        const result = await pool.query(query, [id]);
        res.status(200).json(result.rows);
    } catch (error: any) {
        console.error("Error al consultar historial de créditos:", error);
        res.status(500).json({ message: "Error interno al consultar el historial." });
    }
};
