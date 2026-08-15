import { Response } from "express";
import { pool } from "../db";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

export interface SaleItemInput {
    productId: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
}

/**
 * Procesar una venta POS (Facturación instantánea con control de stock y créditos)
 * POST /api/sales
 */
export const createSale = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { clientId, items, paymentMethod, receivedAmount } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ message: "La venta debe incluir al menos un producto." });
        return;
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. Obtener o verificar cliente
        let targetClientId = clientId;
        if (!targetClientId) {
            const defaultClientRes = await client.query("SELECT id FROM sales.clients WHERE is_default = true LIMIT 1");
            if (defaultClientRes.rows.length === 0) {
                await client.query("ROLLBACK");
                res.status(500).json({ message: "No se encontró el cliente por defecto (Consumidor Final)." });
                return;
            }
            targetClientId = defaultClientRes.rows[0].id;
        }

        const clientRes = await client.query("SELECT id, name, credit_limit, credit_balance FROM sales.clients WHERE id = $1 FOR UPDATE", [targetClientId]);
        if (clientRes.rows.length === 0) {
            await client.query("ROLLBACK");
            res.status(404).json({ message: "El cliente especificado no existe." });
            return;
        }
        const clientData = clientRes.rows[0];

        // 2. Validar productos, calcular totales y verificar stock
        let subtotal = 0;
        let totalTax = 0;
        const processedItems: Array<{
            productId: string;
            productName: string;
            quantity: number;
            unitPrice: number;
            taxRate: number;
            lineTotal: number;
            prevStock: number;
            newStock: number;
        }> = [];

        for (const item of items as SaleItemInput[]) {
            if (!item.productId || !item.quantity || item.quantity <= 0) {
                await client.query("ROLLBACK");
                res.status(400).json({ message: "Cantidad o producto inválido en los ítems." });
                return;
            }

            const prodRes = await client.query(
                "SELECT id, name, stock, sale_price, tax_rate, active FROM inventory.products WHERE id = $1 FOR UPDATE",
                [item.productId]
            );

            if (prodRes.rows.length === 0 || !prodRes.rows[0].active) {
                await client.query("ROLLBACK");
                res.status(400).json({ message: `El producto con ID ${item.productId} no está disponible.` });
                return;
            }

            const prod = prodRes.rows[0];
            if (prod.stock < item.quantity) {
                await client.query("ROLLBACK");
                res.status(400).json({
                    message: `Stock insuficiente para "${prod.name}". Stock disponible: ${prod.stock}, solicitado: ${item.quantity}.`
                });
                return;
            }

            const unitPrice = parseFloat(item.unitPrice !== undefined ? String(item.unitPrice) : prod.sale_price);
            const taxRate = parseFloat(item.taxRate !== undefined ? String(item.taxRate) : prod.tax_rate);
            const lineSub = unitPrice * item.quantity;
            const lineTax = (lineSub * taxRate) / 100;
            const lineTotal = lineSub + lineTax;

            subtotal += lineSub;
            totalTax += lineTax;

            processedItems.push({
                productId: prod.id,
                productName: prod.name,
                quantity: item.quantity,
                unitPrice,
                taxRate,
                lineTotal,
                prevStock: prod.stock,
                newStock: prod.stock - item.quantity
            });
        }

        const totalInvoice = subtotal + totalTax;

        // 3. Si la venta es a CRÉDITO, validar el cupo disponible del cliente
        if (paymentMethod === "CREDIT") {
            const currentCreditBalance = parseFloat(clientData.credit_balance || 0);
            const creditLimit = parseFloat(clientData.credit_limit || 0);
            const newCreditBalance = currentCreditBalance + totalInvoice;

            if (creditLimit > 0 && newCreditBalance > creditLimit) {
                await client.query("ROLLBACK");
                res.status(400).json({
                    message: `El cupo de crédito ($${creditLimit.toLocaleString()}) fue superado. Saldo actual: $${currentCreditBalance.toLocaleString()}, Venta: $${totalInvoice.toLocaleString()}.`
                });
                return;
            }

            // Actualizar el saldo de deuda del cliente
            await client.query("UPDATE sales.clients SET credit_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [
                newCreditBalance,
                targetClientId
            ]);
        }

        // 4. Generar número consecutivo de factura
        const seqRes = await client.query("SELECT nextval('sales.seq_invoice_number') as num");
        const invoiceNumber = `FV-${seqRes.rows[0].num}`;

        const recAmt = parseFloat(receivedAmount || totalInvoice);
        const changeAmt = recAmt > totalInvoice ? recAmt - totalInvoice : 0;
        const sellerId = req.user?.id;

        // 5. Insertar cabecera de la factura
        const invoiceInsertQuery = `
      INSERT INTO sales.invoices
        (invoice_number, client_id, subtotal, tax_amount, total, payment_method, seller_id, received_amount, change_amount)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, invoice_number, created_at;
    `;

        // Si sellerId no es un UUID válido de la tabla auth.users, traemos el primer admin
        let validSellerId = sellerId;
        const checkUser = await client.query("SELECT id FROM auth.users WHERE id = $1", [sellerId]);
        if (checkUser.rows.length === 0) {
            const adminUser = await client.query("SELECT id FROM auth.users LIMIT 1");
            validSellerId = adminUser.rows[0].id;
        }

        const invRes = await client.query(invoiceInsertQuery, [
            invoiceNumber,
            targetClientId,
            subtotal,
            totalTax,
            totalInvoice,
            paymentMethod || "CASH",
            validSellerId,
            recAmt,
            changeAmt
        ]);

        const invoiceId = invRes.rows[0].id;

        // 6. Insertar ítems, descontar inventario y generar trazabilidad
        for (const item of processedItems) {
            await client.query(
                `INSERT INTO sales.invoice_items 
          (invoice_id, product_id, product_name, quantity, unit_price, tax_rate, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [invoiceId, item.productId, item.productName, item.quantity, item.unitPrice, item.taxRate, item.lineTotal]
            );

            // Descontar del catálogo
            await client.query("UPDATE inventory.products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [
                item.newStock,
                item.productId
            ]);

            // Trazabilidad stock_movements
            await client.query(
                `INSERT INTO inventory.stock_movements 
          (product_id, movement_type, quantity, previous_stock, new_stock, reference_type, reference_id, performed_by, notes)
         VALUES ($1, 'SALE', $2, $3, $4, 'INVOICE', $5, $6, $7)`,
                [
                    item.productId,
                    -item.quantity,
                    item.prevStock,
                    item.newStock,
                    invoiceId,
                    validSellerId,
                    `Venta registrada en Factura #${invoiceNumber}`
                ]
            );
        }

        await client.query("COMMIT");

        res.status(201).json({
            message: "Venta registrada con éxito",
            invoice: {
                id: invoiceId,
                invoiceNumber,
                subtotal,
                taxAmount: totalTax,
                total: totalInvoice,
                paymentMethod: paymentMethod || "CASH",
                receivedAmount: recAmt,
                changeAmount: changeAmt,
                createdAt: invRes.rows[0].created_at
            }
        });
    } catch (error: any) {
        await client.query("ROLLBACK");
        console.error("Error al procesar la venta:", error);
        res.status(500).json({ message: "Error interno al procesar la facturación de venta." });
    } finally {
        client.release();
    }
};

/**
 * Obtener historial completo de facturas emitidas
 * GET /api/sales
 */
export const getSalesHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const query = `
      SELECT i.id, i.invoice_number, i.subtotal, i.tax_amount, i.total, i.payment_method, i.status,
             i.received_amount, i.change_amount, i.created_at,
             c.name as client_name, c.nit_or_cc as client_nit,
             u.name as seller_name
      FROM sales.invoices i
      JOIN sales.clients c ON c.id = i.client_id
      JOIN auth.users u ON u.id = i.seller_id
      ORDER BY i.created_at DESC;
    `;
        const result = await pool.query(query);

        const invoices = result.rows.map((row) => ({
            id: row.id,
            invoiceNumber: row.invoice_number,
            clientName: row.client_name,
            clientNit: row.client_nit,
            sellerName: row.seller_name,
            subtotal: parseFloat(row.subtotal),
            taxAmount: parseFloat(row.tax_amount),
            total: parseFloat(row.total),
            paymentMethod: row.payment_method,
            status: row.status,
            receivedAmount: parseFloat(row.received_amount),
            changeAmount: parseFloat(row.change_amount),
            createdAt: row.created_at
        }));

        res.status(200).json(invoices);
    } catch (error: any) {
        console.error("Error al obtener historial de ventas:", error);
        res.status(500).json({ message: "Error al recuperar el historial de ventas." });
    }
};

/**
 * Obtener detalle de una factura específica
 * GET /api/sales/:id
 */
export const getSaleDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const invQuery = `
      SELECT i.id, i.invoice_number, i.subtotal, i.tax_amount, i.total, i.payment_method, i.status,
             i.received_amount, i.change_amount, i.created_at,
             c.id as client_id, c.name as client_name, c.nit_or_cc as client_nit, c.address as client_address,
             u.name as seller_name
      FROM sales.invoices i
      JOIN sales.clients c ON c.id = i.client_id
      JOIN auth.users u ON u.id = i.seller_id
      WHERE i.id = $1;
    `;
        const invRes = await pool.query(invQuery, [id]);

        if (invRes.rows.length === 0) {
            res.status(404).json({ message: "Factura no encontrada." });
            return;
        }

        const itemsQuery = `
      SELECT id, product_id, product_name, quantity, unit_price, tax_rate, line_total
      FROM sales.invoice_items
      WHERE invoice_id = $1;
    `;
        const itemsRes = await pool.query(itemsQuery, [id]);

        const invoice = invRes.rows[0];
        res.status(200).json({
            id: invoice.id,
            invoiceNumber: invoice.invoice_number,
            client: {
                id: invoice.client_id,
                name: invoice.client_name,
                nit: invoice.client_nit,
                address: invoice.client_address
            },
            sellerName: invoice.seller_name,
            subtotal: parseFloat(invoice.subtotal),
            taxAmount: parseFloat(invoice.tax_amount),
            total: parseFloat(invoice.total),
            paymentMethod: invoice.payment_method,
            status: invoice.status,
            receivedAmount: parseFloat(invoice.received_amount),
            changeAmount: parseFloat(invoice.change_amount),
            createdAt: invoice.created_at,
            items: itemsRes.rows.map((it) => ({
                id: it.id,
                productId: it.product_id,
                productName: it.product_name,
                quantity: it.quantity,
                unitPrice: parseFloat(it.unit_price),
                taxRate: parseFloat(it.tax_rate),
                lineTotal: parseFloat(it.line_total)
            }))
        });
    } catch (error: any) {
        console.error("Error al obtener detalle de la venta:", error);
        res.status(500).json({ message: "Error al recuperar el detalle de la factura." });
    }
};
