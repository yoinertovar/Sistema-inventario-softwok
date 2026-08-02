import { readJSON, writeJSON } from "./storage.service";
import { addAuditLog } from "./auditLog.service";

export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string; // ID of the category
  purchasePrice: number;
  salePrice: number;
  taxRate: number; // e.g. 19 for 19% IVA
  stock: number;
  minStock: number;
  active: boolean;
  description: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

const PRODUCTS_KEY = "softwork_products";
const CATEGORIES_KEY = "softwork_categories";

const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-1", name: "Alimentos y Abarrotes", description: "Productos de consumo diario, granos, aceites y víveres" },
  { id: "cat-2", name: "Tecnología", description: "Periféricos, cables, accesorios de cómputo y oficina" },
  { id: "cat-3", name: "Ferretería y Eléctricos", description: "Herramientas, bombillos, cables eléctricos y repuestos" },
  { id: "cat-4", name: "Bebidas", description: "Gaseosas, refrescos, aguas y jugos embotellados" },
];

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "prod-1",
    barcode: "7702001041112",
    name: "Arroz Diana Florhuila Premium 1kg",
    category: "cat-1",
    purchasePrice: 3200,
    salePrice: 4500,
    taxRate: 0, // Arroz is exempt in Colombia
    stock: 55,
    minStock: 15,
    active: true,
    description: "Arroz blanco de grano seleccionado de excelente calidad.",
  },
  {
    id: "prod-2",
    barcode: "7702001052224",
    name: "Aceite Gourmet Multiusos 1L",
    category: "cat-1",
    purchasePrice: 9500,
    salePrice: 13900,
    taxRate: 5, // 5% basket rate
    stock: 22,
    minStock: 8,
    active: true,
    description: "Aceite vegetal de soya y girasol refinado libre de colesterol.",
  },
  {
    id: "prod-3",
    barcode: "7702001063337",
    name: "Café Sello Rojo 500g",
    category: "cat-1",
    purchasePrice: 8200,
    salePrice: 11500,
    taxRate: 0,
    stock: 35,
    minStock: 10,
    active: true,
    description: "Café molido tradicional de aroma intenso y tueste medio.",
  },
  {
    id: "prod-4",
    barcode: "097855146526",
    name: "Mouse Inalámbrico Logitech M185 Gris",
    category: "cat-2",
    purchasePrice: 48000,
    salePrice: 79900,
    taxRate: 19, // standard 19% IVA
    stock: 12,
    minStock: 3,
    active: true,
    description: "Mouse inalámbrico de 2.4 GHz con receptor USB ultra compacto.",
  },
  {
    id: "prod-5",
    barcode: "6950376781215",
    name: "Teclado Mecánico Redragon Kumara K552 RGB",
    category: "cat-2",
    purchasePrice: 135000,
    salePrice: 219000,
    taxRate: 19,
    stock: 4,
    minStock: 2,
    active: true,
    description: "Teclado mecánico gamer formato TKL (sin teclado numérico), switches azules.",
  },
  {
    id: "prod-6",
    barcode: "8718696507513",
    name: "Bombillo LED Philips EcoHome 9W E27 Luz Fría",
    category: "cat-3",
    purchasePrice: 4200,
    salePrice: 7500,
    taxRate: 19,
    stock: 65,
    minStock: 12,
    active: true,
    description: "Bombillo LED de alta eficiencia con 15.000 horas de vida útil.",
  },
  {
    id: "prod-7",
    barcode: "7702004000185",
    name: "Coca-Cola Original Sabor Original 1.5L",
    category: "cat-4",
    purchasePrice: 3800,
    salePrice: 5200,
    taxRate: 19,
    stock: 40,
    minStock: 10,
    active: true,
    description: "Bebida gaseosa azucarada familiar sabor original.",
  },
];

/**
 * Gets all categories.
 */
export const getCategories = (): Category[] => {
  const categories = readJSON<Category[]>(CATEGORIES_KEY, []);
  if (categories.length === 0) {
    writeJSON(CATEGORIES_KEY, DEFAULT_CATEGORIES);
    return DEFAULT_CATEGORIES;
  }
  return categories;
};

/**
 * Saves all categories.
 */
export const saveCategories = (categories: Category[]): void => {
  writeJSON(CATEGORIES_KEY, categories);
};

/**
 * Gets all products.
 */
export const getProducts = (): Product[] => {
  const products = readJSON<Product[]>(PRODUCTS_KEY, []);
  if (products.length === 0) {
    writeJSON(PRODUCTS_KEY, DEFAULT_PRODUCTS);
    return DEFAULT_PRODUCTS;
  }
  return products;
};

/**
 * Saves all products.
 */
export const saveProducts = (products: Product[]): void => {
  writeJSON(PRODUCTS_KEY, products);
};

/**
 * Upserts a product.
 */
export const upsertProduct = (product: Product): Product => {
  const products = getProducts();
  const index = products.findIndex((p) => p.id === product.id);

  if (index >= 0) {
    const prev = products[index];
    const priceChanged = prev.salePrice !== product.salePrice;
    products[index] = { ...products[index], ...product };

    // Audit Log for Price Change or Inventory Modify
    addAuditLog({
      userId: "admin@softwork.co",
      userName: "Administrador General",
      userRole: "ADMIN",
      category: priceChanged ? "PRICE_CHANGE" : "INVENTORY_MODIFY",
      severity: priceChanged ? "MEDIUM" : "INFO",
      action: priceChanged ? "CAMBIO_PRECIO" : "ACTUALIZAR_PRODUCTO",
      entityId: product.id,
      entityName: product.name,
      details: priceChanged
        ? `Precio de venta modificado para "${product.name}". Anterior: $${prev.salePrice.toLocaleString("es-CO")} COP -> Nuevo: $${product.salePrice.toLocaleString("es-CO")} COP.`
        : `Información del producto "${product.name}" modificada (Stock: ${product.stock}u, Mínimo: ${product.minStock}u).`,
      previousState: priceChanged ? `Precio: $${prev.salePrice} COP` : `Stock: ${prev.stock}u`,
      newState: priceChanged ? `Precio: $${product.salePrice} COP` : `Stock: ${product.stock}u`
    });
  } else {
    product.id = product.id || `prod-${Date.now()}`;
    products.push(product);

    addAuditLog({
      userId: "admin@softwork.co",
      userName: "Administrador General",
      userRole: "ADMIN",
      category: "INVENTORY_MODIFY",
      severity: "INFO",
      action: "CREAR_PRODUCTO",
      entityId: product.id,
      entityName: product.name,
      details: `Nuevo producto "${product.name}" registrado en catálogo con stock inicial de ${product.stock}u a $${product.salePrice.toLocaleString("es-CO")} COP.`,
      newState: `Creado con stock ${product.stock}u`
    });
  }

  saveProducts(products);
  return product;
};

/**
 * Deletes a product.
 */
export const deleteProduct = (id: string): boolean => {
  const products = getProducts();
  const targetProd = products.find((p) => p.id === id);
  const filtered = products.filter((p) => p.id !== id);

  if (filtered.length !== products.length) {
    saveProducts(filtered);

    // Critical Audit Log for Deletion
    addAuditLog({
      userId: "admin@softwork.co",
      userName: "Administrador General",
      userRole: "ADMIN",
      category: "ENTRY_DELETE",
      severity: "CRITICAL",
      action: "ELIMINAR_PRODUCTO",
      entityId: id,
      entityName: targetProd?.name || `Producto ${id}`,
      details: `Eliminación permanente del producto "${targetProd?.name || id}" del catálogo comercial de la empresa.`,
      previousState: targetProd ? `Producto Activo: ${targetProd.name}, Stock: ${targetProd.stock}u` : undefined,
      newState: "Eliminado del catálogo"
    });

    return true;
  }
  return false;
};

/**
 * Searches and filters products.
 */
export const findProducts = (query: string): Product[] => {
  const products = getProducts().filter((p) => p.active);
  if (!query) return products;

  const cleanQuery = query.toLowerCase().trim();
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(cleanQuery) ||
      p.barcode.includes(cleanQuery) ||
      p.description.toLowerCase().includes(cleanQuery)
  );
};

/**
 * Adjusts stock levels for multiple items.
 * Can be negative (for sales/deliveries) or positive (for returns/purchases).
 */
export const bulkAdjustStock = (adjustments: { id: string; qty: number }[]): void => {
  const products = getProducts();
  let updated = false;

  adjustments.forEach((adj) => {
    const prod = products.find((p) => p.id === adj.id);
    if (prod) {
      const prevStock = prod.stock;
      prod.stock = Math.max(0, prod.stock + adj.qty);
      updated = true;

      // Log stock adjustments
      if (Math.abs(adj.qty) > 0) {
        addAuditLog({
          userId: "admin@softwork.co",
          userName: "Administrador / Sistema",
          userRole: "ADMIN",
          category: "INVENTORY_MODIFY",
          severity: adj.qty < 0 ? "HIGH" : "INFO",
          action: "AJUSTE_STOCK_PROD",
          entityId: prod.id,
          entityName: prod.name,
          details: `Ajuste manual/operativo de stock para "${prod.name}". Variación: ${adj.qty > 0 ? `+${adj.qty}` : adj.qty} unidades.`,
          previousState: `Stock anterior: ${prevStock}u`,
          newState: `Nuevo stock: ${prod.stock}u`
        });
      }
    }
  });

  if (updated) {
    saveProducts(products);
  }
};
