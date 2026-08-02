import path from "path";
import dotenv from "dotenv";

dotenv.config();

export const PORT = 3000;
export const DATA_DIR = path.join(process.cwd(), "data");
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
