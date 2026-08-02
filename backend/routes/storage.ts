import { Router } from "express";
import fs from "fs";
import path from "path";
import { DATA_DIR } from "../config";

const router = Router();

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Get all stored keys
router.get("/", (req, res) => {
  try {
    const result: Record<string, any> = {};
    if (fs.existsSync(DATA_DIR)) {
      const files = fs.readdirSync(DATA_DIR);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const key = decodeURIComponent(file.slice(0, -5));
          try {
            const content = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
            result[key] = JSON.parse(content);
          } catch (e) {
            // ignore invalid files
          }
        }
      }
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Save key
router.post("/:key", (req, res) => {
  try {
    const key = req.params.key;
    const filename = `${encodeURIComponent(key)}.json`;
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2), "utf-8");
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete key
router.delete("/:key", (req, res) => {
  try {
    const key = req.params.key;
    const filename = `${encodeURIComponent(key)}.json`;
    const filePath = path.join(DATA_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
