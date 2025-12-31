const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// Postgres connection (Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ---------- ROUTES ----------

// Root
app.get("/", (req, res) => {
  res.json({ message: "PaisaDekho Node API + Neon LIVE ✅" });
});

// Health
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "healthy" });
  } catch {
    res.json({ status: "db_error" });
  }
});

// Create or get user
app.post("/users", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "phone required" });

  try {
    const existing = await pool.query("SELECT id FROM users WHERE phone=$1", [
      phone,
    ]);
    if (existing.rowCount > 0) {
      return res.json({
        user_id: existing.rows[0].id,
        phone,
        status: "existing_user",
      });
    }

    const result = await pool.query(
      "INSERT INTO users (phone) VALUES ($1) RETURNING id",
      [phone]
    );

    return res.json({
      user_id: result.rows[0].id,
      phone,
      status: "new_user_created",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get user profile
app.get("/users/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const user = await pool.query("SELECT id, phone FROM users WHERE id=$1", [
      id,
    ]);
    if (user.rowCount === 0)
      return res.status(404).json({ error: "User not found" });

    const profile = await pool.query(
      "SELECT full_name, pincode FROM user_profiles WHERE user_id=$1",
      [id]
    );

    res.json({
      user_id: user.rows[0].id,
      phone: user.rows[0].phone,
      full_name: profile.rows[0]?.full_name || null,
      pincode: profile.rows[0]?.pincode || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save/update user profile
app.post("/users/:id/profile", async (req, res) => {
  const { id } = req.params;
  const { full_name, pincode } = req.body;

  try {
    await pool.query(
      `
      INSERT INTO user_profiles (user_id, full_name, pincode)
      VALUES ($1,$2,$3)
      ON CONFLICT (user_id)
      DO UPDATE SET full_name=$2, pincode=$3
    `,
      [id, full_name, pincode]
    );

    res.json({ status: "profile_saved" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
