import { Response } from "express";
import { pool } from "../db";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

/**
 * Obtener todos los productos con el nombre de su categoría
 * GET /api/products
 */
export const getProducts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const query = `
      SELECT p.id, p.barcode, p.name, p.category_id, c.name as category_name,
             p.purchase_price, p.sale_price, p.tax_rate, p.stock, p.min_stock,
             p.active, p.description, p.created_at, p.updated_at
      FROM inventory.products p
      LEFT JOIN inventory.categories c ON c.id = p.category_id
      WHERE p.active = true
      ORDER BY p.created_at DESC;
    `;
        const result = await pool.query(query);

        const products = result.rows.map((row) => ({
            id: row.id,
            barcode: row.barcode || "",
            name: row.name,
            categoryId: row.category_id,
            categoryName: row.category_name || "Sin categoría",
            purchasePrice: parseFloat(row.purchase_price || 0),
            salePrice: parseFloat(row.sale_price || 0),
            taxRate: parseFloat(row.tax_rate || 19),
            stock: row.stock,
            minStock: row.min_stock,
            active: row.active,
            description: row.description || "",
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));

        res.status(200).json(products);
    } catch (error: any) {
        console.error("Error al obtener productos:", error);
        res.status(500).json({ message: "Error interno al consultar el catálogo de productos." });
    }
};

/**
 * Obtener todas las categorías de productos
 * GET /api/categories
 */
export const getCategories = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const query = "SELECT id, name, description, active FROM inventory.categories WHERE active = true ORDER BY name ASC;";
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error: any) {
        console.error("Error al obtener categorías:", error);
        res.status(500).json({ message: "Error interno al consultar las categorías." });
    }
};

/**
 * Crear una nueva categoría
 * POST /api/categories
 */
export const createCategory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { name, description } = req.body;
    if (!name || name.trim() === "") {
        res.status(400).json({ message: "El nombre de la categoría es obligatorio." });
        return;
    }

    try {
        const query = `
      INSERT INTO inventory.categories (name, description)
      VALUES ($1, $2)
      RETURNING id, name, description, active, created_at;
    `;
        const result = await pool.query(query, [name.trim(), description || ""]);
        res.status(201).json({ message: "Categoría creada con éxito", category: result.rows[0] });
    } catch (error: any) {
        console.error("Error al crear categoría:", error);
        res.status(500).json({ message: "Error al crear la categoría. Asegúrese de que no exista duplicada." });
    }
};

/**
 * Crear un nuevo producto
 * POST /api/products
 */
export const createProduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { barcode, name, categoryId, purchasePrice, salePrice, taxRate, stock, minStock, description } = req.body;

    if (!name || name.trim() === "") {
        res.status(400).json({ message: "El nombre del producto es obligatorio." });
        return;
    }

    const pPrice = parseFloat(purchasePrice || 0);
    const sPrice = parseFloat(salePrice || 0);

    if (sPrice < pPrice) {
        res.status(400).json({ message: "El precio de venta no puede ser menor al precio de compra." });
        return;
    }

    try {
        const insertQuery = `
      INSERT INTO inventory.products 
        (barcode, name, category_id, purchase_price, sale_price, tax_rate, stock, min_stock, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

        const result = await pool.query(insertQuery, [
            barcode || null,
            name.trim(),
            categoryId || null,
            pPrice,
            sPrice,
            parseFloat(taxRate || 19),
            parseInt(stock || 0, 10),
            parseInt(minStock || 0, 10),
            description || ""
        ]);

        const row = result.rows[0];
        res.status(201).json({
            message: "Producto creado con éxito",
            product: {
                id: row.id,
                barcode: row.barcode || "",
                name: row.name,
                categoryId: row.category_id,
                purchasePrice: parseFloat(row.purchase_price),
                salePrice: parseFloat(row.sale_price),
                taxRate: parseFloat(row.tax_rate),
                stock: row.stock,
                minStock: row.min_stock,
                active: row.active,
                description: row.description || ""
            }
        });
    } catch (error: any) {
        console.error("Error al crear producto:", error);
        res.status(500).json({ message: "Error al registrar el producto. Verifique el código de barras o valores." });
    }
};

/**
 * Actualizar datos de un producto
 * PUT /api/products/:id
 */
export const updateProduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { barcode, name, categoryId, purchasePrice, salePrice, taxRate, stock, minStock, description, active } = req.body;

    try {
        const updateQuery = `
      UPDATE inventory.products
      SET barcode = COALESCE($1, barcode),
          name = COALESCE($2, name),
          category_id = COALESCE($3, category_id),
          purchase_price = COALESCE($4, purchase_price),
          sale_price = COALESCE($5, sale_price),
          tax_rate = COALESCE($6, tax_rate),
          stock = COALESCE($7, stock),
          min_stock = COALESCE($8, min_stock),
          description = COALESCE($9, description),
          active = COALESCE($10, active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *;
    `;

        const result = await pool.query(updateQuery, [
            barcode, name, categoryId, purchasePrice, salePrice, taxRate, stock, minStock, description, active, id
        ]);

        if (result.rows.length === 0) {
            res.status(404).json({ message: "Producto no encontrado." });
            return;
        }

        const row = result.rows[0];
        res.status(200).json({
            message: "Producto actualizado correctamente",
            product: {
                id: row.id,
                barcode: row.barcode || "",
                name: row.name,
                categoryId: row.category_id,
                purchasePrice: parseFloat(row.purchase_price),
                salePrice: parseFloat(row.sale_price),
                taxRate: parseFloat(row.tax_rate),
                stock: row.stock,
                minStock: row.min_stock,
                active: row.active,
                description: row.description || ""
            }
        });
    } catch (error: any) {
        console.error("Error al actualizar producto:", error);
        res.status(500).json({ message: "Error interno al actualizar el producto." });
    }
};

/**
 * Ajustar stock de un producto (con registro en trazabilidad stock_movements)
 * POST /api/products/:id/adjust-stock
 */
export const adjustStock = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { newQuantity, reason, notes } = req.body;

    if (newQuantity === undefined || newQuantity < 0) {
        res.status(400).json({ message: "La nueva cantidad debe ser igual o mayor a cero." });
        return;
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const productRes = await client.query("SELECT id, name, stock FROM inventory.products WHERE id = $1 FOR UPDATE", [id]);
        if (productRes.rows.length === 0) {
            await client.query("ROLLBACK");
            res.status(404).json({ message: "Producto no encontrado." });
            return;
        }

        const prevStock = productRes.rows[0].stock;
        const diff = newQuantity - prevStock;

        if (diff === 0) {
            await client.query("ROLLBACK");
            res.status(200).json({ message: "El stock no requirió cambios.", currentStock: prevStock });
            return;
        }

        // Actualizar stock del producto
        await client.query("UPDATE inventory.products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [newQuantity, id]);

        // Registrar movimiento de inventario
        await client.query(
            `INSERT INTO inventory.stock_movements 
        (product_id, movement_type, quantity, previous_stock, new_stock, reference_type, notes)
       VALUES ($1, 'ADJUSTMENT', $2, $3, $4, 'MANUAL', $5)`,
            [id, diff, prevStock, newQuantity, notes || reason || "Ajuste manual de inventario"]
        );

        await client.query("COMMIT");
        res.status(200).json({
            message: "Stock ajustado exitosamente",
            previousStock: prevStock,
            newStock: newQuantity,
            adjustmentQuantity: diff
        });
    } catch (error: any) {
        await client.query("ROLLBACK");
        console.error("Error al ajustar stock:", error);
        res.status(500).json({ message: "Error al realizar el ajuste de inventario." });
    } finally {
        client.release();
    }
};

/**
 * Desactivar / Eliminar un producto
 * DELETE /api/products/:id
 */
export const deleteProduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
        const result = await pool.query("UPDATE inventory.products SET active = false WHERE id = $1 RETURNING id", [id]);
        if (result.rows.length === 0) {
            res.status(404).json({ message: "Producto no encontrado." });
            return;
        }
        res.status(200).json({ message: "Producto desactivado correctamente." });
    } catch (error: any) {
        console.error("Error al desactivar producto:", error);
        res.status(500).json({ message: "Error al desactivar el producto." });
    }
};
