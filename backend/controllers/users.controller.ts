import { Response } from "express";
import { pool } from "../db";
import bcrypt from "bcryptjs";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

/**
 * Obtener todos los usuarios con sus permisos asignados
 * GET /api/users
 */
export const getUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const usersQuery = `
      SELECT u.id, u.name, u.email, u.role, u.active, u.base_salary, u.commission_rate, u.phone, u.created_at,
             COALESCE(json_agg(p.code) FILTER (WHERE p.code IS NOT NULL), '[]') as permissions
      FROM auth.users u
      LEFT JOIN auth.user_permissions up ON up.user_id = u.id
      LEFT JOIN auth.permissions p ON p.id = up.permission_id
      GROUP BY u.id
      ORDER BY u.created_at DESC;
    `;
        const result = await pool.query(usersQuery);

        const formattedUsers = result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            email: row.email,
            role: row.role,
            active: row.active,
            baseSalary: parseFloat(row.base_salary || 0),
            commissionRate: parseFloat(row.commission_rate || 0),
            phone: row.phone || "",
            permissions: row.permissions,
            createdAt: row.created_at
        }));

        res.status(200).json(formattedUsers);
    } catch (error: any) {
        console.error("Error al obtener usuarios:", error);
        res.status(500).json({ message: "Error interno al recuperar la lista de usuarios." });
    }
};

/**
 * Crear un nuevo usuario con permisos y hash de contraseña
 * POST /api/users
 */
export const createUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { name, email, password, role, active, baseSalary, commissionRate, phone, permissions } = req.body;

    if (!name || !email || !password || !role) {
        res.status(400).json({ message: "Nombre, email, contraseña y rol son campos requeridos." });
        return;
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Verificar si el correo ya existe
        const existing = await client.query("SELECT id FROM auth.users WHERE email = $1", [email]);
        if (existing.rows.length > 0) {
            await client.query("ROLLBACK");
            res.status(400).json({ message: "El correo electrónico ya está registrado en el sistema." });
            return;
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const insertUserQuery = `
      INSERT INTO auth.users (name, email, password_hash, role, active, base_salary, commission_rate, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, email, role, active, base_salary, commission_rate, phone, created_at;
    `;

        const userRes = await client.query(insertUserQuery, [
            name,
            email,
            passwordHash,
            role,
            active !== undefined ? active : true,
            baseSalary || 0,
            commissionRate || 0,
            phone || ""
        ]);

        const newUser = userRes.rows[0];

        // Asignar permisos si se proporcionaron y el rol es WORKER
        if (Array.isArray(permissions) && permissions.length > 0) {
            const permRes = await client.query("SELECT id, code FROM auth.permissions WHERE code = ANY($1)", [permissions]);
            for (const p of permRes.rows) {
                await client.query(
                    "INSERT INTO auth.user_permissions (user_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                    [newUser.id, p.id]
                );
            }
        }

        await client.query("COMMIT");

        res.status(201).json({
            message: "Usuario creado exitosamente",
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                active: newUser.active,
                baseSalary: parseFloat(newUser.base_salary),
                commissionRate: parseFloat(newUser.commission_rate),
                phone: newUser.phone,
                permissions: permissions || []
            }
        });
    } catch (error: any) {
        await client.query("ROLLBACK");
        console.error("Error al crear usuario:", error);
        res.status(500).json({ message: "Error interno del servidor al crear el usuario." });
    } finally {
        client.release();
    }
};

/**
 * Actualizar datos de un usuario
 * PUT /api/users/:id
 */
export const updateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name, email, password, role, active, baseSalary, commissionRate, phone, permissions } = req.body;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        let passwordHashUpdate = "";
        if (password && password.trim() !== "") {
            const salt = await bcrypt.genSalt(10);
            passwordHashUpdate = await bcrypt.hash(password, salt);
        }

        const updateUserQuery = `
      UPDATE auth.users
      SET name = COALESCE($1, name),
          email = COALESCE($2, email),
          role = COALESCE($3, role),
          active = COALESCE($4, active),
          base_salary = COALESCE($5, base_salary),
          commission_rate = COALESCE($6, commission_rate),
          phone = COALESCE($7, phone),
          password_hash = CASE WHEN $8 != '' THEN $8 ELSE password_hash END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING id, name, email, role, active, base_salary, commission_rate, phone;
    `;

        const userRes = await client.query(updateUserQuery, [
            name, email, role, active, baseSalary, commissionRate, phone, passwordHashUpdate, id
        ]);

        if (userRes.rows.length === 0) {
            await client.query("ROLLBACK");
            res.status(404).json({ message: "Usuario no encontrado." });
            return;
        }

        // Actualizar permisos si viene array
        if (Array.isArray(permissions)) {
            await client.query("DELETE FROM auth.user_permissions WHERE user_id = $1", [id]);
            if (permissions.length > 0) {
                const permRes = await client.query("SELECT id, code FROM auth.permissions WHERE code = ANY($1)", [permissions]);
                for (const p of permRes.rows) {
                    await client.query(
                        "INSERT INTO auth.user_permissions (user_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                        [id, p.id]
                    );
                }
            }
        }

        await client.query("COMMIT");

        const updatedUser = userRes.rows[0];
        res.status(200).json({
            message: "Usuario actualizado correctamente",
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                active: updatedUser.active,
                baseSalary: parseFloat(updatedUser.base_salary),
                commissionRate: parseFloat(updatedUser.commission_rate),
                phone: updatedUser.phone,
                permissions: permissions || []
            }
        });
    } catch (error: any) {
        await client.query("ROLLBACK");
        console.error("Error al actualizar usuario:", error);
        res.status(500).json({ message: "Error interno al actualizar el usuario." });
    } finally {
        client.release();
    }
};

/**
 * Eliminar o desactivar un usuario
 * DELETE /api/users/:id
 */
export const deleteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
        const result = await pool.query("UPDATE auth.users SET active = false WHERE id = $1 RETURNING id", [id]);
        if (result.rows.length === 0) {
            res.status(404).json({ message: "Usuario no encontrado." });
            return;
        }
        res.status(200).json({ message: "Usuario desactivado exitosamente." });
    } catch (error: any) {
        console.error("Error al desactivar usuario:", error);
        res.status(500).json({ message: "Error interno al procesar la solicitud." });
    }
};
