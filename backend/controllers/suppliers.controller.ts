import { Response } from "express";
import { pool } from "../db";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

/**
 * Obtener listado de proveedores
 * GET /api/suppliers
 */
export const getSuppliers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const query = "SELECT id, name, nit, phone, email, address, active, created_at FROM purchasing.suppliers WHERE active = true ORDER BY name ASC;";
        const result = await pool.query(query);

        const suppliers = result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            nit: row.nit,
            phone: row.phone || "",
            email: row.email || "",
            address: row.address || "",
            active: row.active,
            createdAt: row.created_at
        }));

        res.status(200).json(suppliers);
    } catch (error: any) {
        console.error("Error al obtener proveedores:", error);
        res.status(500).json({ message: "Error interno al consultar proveedores." });
    }
};

/**
 * Crear un nuevo proveedor
 * POST /api/suppliers
 */
export const createSupplier = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { name, nit, phone, email, address } = req.body;

    if (!name || !nit) {
        res.status(400).json({ message: "El nombre y NIT del proveedor son requeridos." });
        return;
    }

    try {
        const insertQuery = `
      INSERT INTO purchasing.suppliers (name, nit, phone, email, address)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
        const result = await pool.query(insertQuery, [name.trim(), nit.trim(), phone || "", email || null, address || ""]);
        const row = result.rows[0];

        res.status(201).json({
            message: "Proveedor creado con éxito",
            supplier: {
                id: row.id,
                name: row.name,
                nit: row.nit,
                phone: row.phone || "",
                email: row.email || "",
                address: row.address || "",
                active: row.active
            }
        });
    } catch (error: any) {
        console.error("Error al crear proveedor:", error);
        res.status(500).json({ message: "Error al registrar proveedor. Verifique que el NIT no esté duplicado." });
    }
};

/**
 * Registrar ingreso de compra de mercancía (Restock automático)
 * POST /api/purchases
 */
export const recordPurchase = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { supplierId, supplierInvoice, items } = req.body;

    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ message: "El proveedor y los ítems de compra son requeridos." });
        return;
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Generar consecutivo de compra
        const seqRes = await client.query("SELECT nextval('purchasing.seq_purchase_number') as num");
        const purchaseNumber = `FC-${seqRes.rows[0].num}`;

        let totalPurchase = 0;
        const processedItems: Array<{
            productId: string;
            productName: string;
            quantity: number;
            purchasePrice: number;
            lineTotal: number;
            prevStock: number;
            newStock: number;
        }> = [];

        for (const item of items) {
            if (!item.productId || !item.quantity || item.quantity <= 0) {
                await client.query("ROLLBACK");
                res.status(400).json({ message: "Cantidad o producto inválido en los ítems de compra." });
                return;
            }

            const prodRes = await client.query("SELECT id, name, stock, purchase_price FROM inventory.products WHERE id = $1 FOR UPDATE", [item.productId]);
            if (prodRes.rows.length === 0) {
                await client.query("ROLLBACK");
                res.status(404).json({ message: `Producto no encontrado (ID: ${item.productId}).` });
                return;
            }

            const prod = prodRes.rows[0];
            const pPrice = parseFloat(item.purchasePrice !== undefined ? String(item.purchasePrice) : prod.purchase_price);
            const lineTotal = pPrice * item.quantity;
            totalPurchase += lineTotal;

            processedItems.push({
                productId: prod.id,
                productName: prod.name,
                quantity: item.quantity,
                purchasePrice: pPrice,
                lineTotal,
                prevStock: prod.stock,
                newStock: prod.stock + item.quantity
            });
        }

        // Insertar Factura de Compra
        const purchaseQuery = `
      INSERT INTO purchasing.purchase_invoices (purchase_number, supplier_invoice, supplier_id, total, received_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, purchase_number, created_at;
    `;
        const purchaseRes = await client.query(purchaseQuery, [
            purchaseNumber,
            supplierInvoice || null,
            supplierId,
            totalPurchase,
            req.user?.id || null
        ]);
        const purchaseId = purchaseRes.rows[0].id;

        // Procesar cada ítem
        for (const item of processedItems) {
            await client.query(
                `INSERT INTO purchasing.purchase_items (purchase_invoice_id, product_id, product_name, quantity, purchase_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [purchaseId, item.productId, item.productName, item.quantity, item.purchasePrice, item.lineTotal]
            );

            // Aumentar el stock del producto e ingerir precio de compra actualizado
            await client.query(
                "UPDATE inventory.products SET stock = $1, purchase_price = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
                [item.newStock, item.purchasePrice, item.productId]
            );

            // Trazabilidad stock_movements
            await client.query(
                `INSERT INTO inventory.stock_movements
          (product_id, movement_type, quantity, previous_stock, new_stock, reference_type, reference_id, performed_by, notes)
         VALUES ($1, 'PURCHASE', $2, $3, $4, 'PURCHASE_INVOICE', $5, $6, $7)`,
                [
                    item.productId,
                    item.quantity,
                    item.prevStock,
                    item.newStock,
                    purchaseId,
                    req.user?.id || null,
                    `Ingreso de mercancía por Factura de Compra #${purchaseNumber}`
                ]
            );
        }

        await client.query("COMMIT");
        res.status(201).json({
            message: "Factura de compra e ingreso de mercancía procesados correctamente",
            purchase: {
                id: purchaseId,
                purchaseNumber,
                supplierInvoice,
                total: totalPurchase,
                createdAt: purchaseRes.rows[0].created_at
            }
        });
    } catch (error: any) {
        await client.query("ROLLBACK");
        console.error("Error al registrar compra:", error);
        res.status(500).json({ message: "Error interno al procesar el ingreso de la compra." });
    } finally {
        client.release();
    }
};
