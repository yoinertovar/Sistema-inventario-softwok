import { readJSON, writeJSON } from "./storage.service";
import { getToken } from "./auth.service";

export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string; // ID o nombre de categoría
  purchasePrice: number;
  salePrice: number;
  taxRate: number;
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

/**
 * Obtener productos desde la base de datos PostgreSQL
 */
export const fetchProducts = async (): Promise<Product[]> => {
  try {
    const res = await fetch("/api/products", {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (res.ok) {
      const data = await res.json();
      const mapped = data.map((p: any) => ({
        id: p.id,
        barcode: p.barcode || "",
        name: p.name,
        category: p.categoryId || p.categoryName || "",
        purchasePrice: p.purchasePrice,
        salePrice: p.salePrice,
        taxRate: p.taxRate,
        stock: p.stock,
        minStock: p.minStock,
        active: p.active,
        description: p.description || ""
      }));
      writeJSON(PRODUCTS_KEY, mapped);
      return mapped;
    }
  } catch (error) {
    console.warn("Fallo de red al consultar productos en PG, usando cache local:", error);
  }
  return readJSON<Product[]>(PRODUCTS_KEY, []);
};

/**
 * Obtener categorías desde la base de datos PostgreSQL
 */
export const fetchCategories = async (): Promise<Category[]> => {
  try {
    const res = await fetch("/api/products/categories", {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (res.ok) {
      const data = await res.json();
      writeJSON(CATEGORIES_KEY, data);
      return data;
    }
  } catch (error) {
    console.warn("Fallo al obtener categorías de la BD:", error);
  }
  return readJSON<Category[]>(CATEGORIES_KEY, []);
};

/**
 * Crear o Actualizar Producto en PostgreSQL
 */
export const upsertProduct = async (product: Partial<Product> & { id?: string }): Promise<Product> => {
  const isUpdate = !!product.id && !product.id.startsWith("prod-");
  const url = isUpdate ? `/api/products/${product.id}` : "/api/products";
  const method = isUpdate ? "PUT" : "POST";

  const bodyData = {
    barcode: product.barcode,
    name: product.name,
    categoryId: product.category,
    purchasePrice: product.purchasePrice,
    salePrice: product.salePrice,
    taxRate: product.taxRate,
    stock: product.stock,
    minStock: product.minStock,
    description: product.description,
    active: product.active ?? true
  };

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify(bodyData)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Error al guardar el producto en la base de datos.");
  }

  // Refrescar el estado local
  await fetchProducts();

  return {
    id: data.product.id,
    barcode: data.product.barcode || "",
    name: data.product.name,
    category: data.product.categoryId || "",
    purchasePrice: data.product.purchasePrice,
    salePrice: data.product.salePrice,
    taxRate: data.product.taxRate,
    stock: data.product.stock,
    minStock: data.product.minStock,
    active: data.product.active,
    description: data.product.description || ""
  };
};

/**
 * Ajuste manual de stock en PostgreSQL
 */
export const adjustProductStock = async (id: string, newQuantity: number, reason?: string): Promise<void> => {
  const res = await fetch(`/api/products/${id}/adjust-stock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify({ newQuantity, reason })
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || "Error al ajustar stock.");
  }

  await fetchProducts();
};

/**
 * Desactivar o eliminar producto en PostgreSQL
 */
export const deleteProduct = async (id: string): Promise<boolean> => {
  try {
    const res = await fetch(`/api/products/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (res.ok) {
      await fetchProducts();
      return true;
    }
  } catch (error) {
    console.error("Error eliminando producto:", error);
  }
  return false;
};

export const bulkAdjustStock = (adjustments: { id: string; qty: number }[]): void => {
  const products = getProducts();
  let updated = false;

  adjustments.forEach((adj) => {
    const prod = products.find((p) => p.id === adj.id);
    if (prod) {
      prod.stock = Math.max(0, prod.stock + adj.qty);
      updated = true;
      // Disparar en segundo plano la actualización al servidor PG
      adjustProductStock(prod.id, prod.stock, "Surtido / Ajuste de stock rápido").catch(console.error);
    }
  });

  if (updated) {
    saveProducts(products);
  }
};

// Compatibilidad síncrona
export const getProducts = (): Product[] => readJSON<Product[]>(PRODUCTS_KEY, []);
export const getCategories = (): Category[] => readJSON<Category[]>(CATEGORIES_KEY, []);
export const saveProducts = (products: Product[]): void => writeJSON(PRODUCTS_KEY, products);
export const saveCategories = (categories: Category[]): void => writeJSON(CATEGORIES_KEY, categories);
export const findProducts = (query: string): Product[] => {
  const products = getProducts().filter((p) => p.active);
  if (!query) return products;
  const clean = query.toLowerCase().trim();
  return products.filter((p) => p.name.toLowerCase().includes(clean) || (p.barcode && p.barcode.includes(clean)));
};

