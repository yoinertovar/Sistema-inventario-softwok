const { pool } = require("./backend/db/index.ts"); // Will fail cause it's TS, need to use tsx

async function testConnection() {
    try {
        const res = await pool.query("SELECT * FROM auth.users LIMIT 1;");
        console.log("Conectado exitosamente, usuarios encontrados:", res.rows.length);
    } catch (err) {
        console.error("Error conectando a Postgres:", err.message);
    } finally {
        pool.end();
    }
}
testConnection();
