import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

// En producción, estas variables se definen en el archivo .env
export const pool = new Pool({
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "softwok",
    password: process.env.DB_PASSWORD || "root",
    port: parseInt(process.env.DB_PORT || "5432", 10),
});

// Prueba de conexión rápida al arrancar el servidor
pool.query("SELECT NOW()")
    .then(() => {
        console.log("✅ ¡Conexión a PostgreSQL (Base de datos: SoftWork) establecida con éxito!");
    })
    .catch((err) => {
        console.error("❌ ¡Alerta! Falló la conexión inicial a PostgreSQL:", err.message);
    });

