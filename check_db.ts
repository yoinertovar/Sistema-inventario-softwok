import { pool } from "./backend/db/index";
import fs from "fs";
import bcrypt from "bcryptjs";

async function run() {
    try {
        const res = await pool.query("SELECT email, password_hash FROM auth.users");
        let output = "Users in DB:\n";
        for (const row of res.rows) {
            output += `Email: ${row.email} | Hash: ${row.password_hash}\n`;
            const pass = row.email === "admin@softwork.co" ? "admin" : "cajero";
            const match = await bcrypt.compare(pass, row.password_hash);
            output += `Password Match for '${pass}': ${match}\n`;
        }

        if (res.rows.length === 0) {
            output += "NO USERS FOUND IN auth.users TABLE!\n";
        }

        fs.writeFileSync("db_diagnostics.txt", output);
        console.log("Diagnostics written.");
    } catch (err: any) {
        fs.writeFileSync("db_diagnostics.txt", "ERROR: " + err.message);
    } finally {
        pool.end();
    }
}

run();
