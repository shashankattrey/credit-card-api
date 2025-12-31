import { pool } from "./db";

export default async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "healthy" });
  } catch (e) {
    res.json({ status: "db_error", error: e.message });
  }
};
