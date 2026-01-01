// netlify/functions/update-user-activity.js
const { Pool } = require("pg");

exports.handler = async (event) => {
  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  // ✅ SAME WORKING PATTERN - NEW pool per request
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const body = JSON.parse(event.body);
    const { phone } = body;

    // 🔥 UPDATE YOUR users table (open_count + last_active_at)
    const updateQuery = `
      UPDATE users 
      SET 
        open_count = open_count + 1,
        last_active_at = NOW(),
        updated_at = NOW()
      WHERE phone = $1
      RETURNING id, phone, open_count, last_active_at, created_at
    `;

    const result = await pool.query(updateQuery, [phone]);

    // ✅ If user doesn't exist, create one
    if (result.rowCount === 0) {
      const createQuery = `
        INSERT INTO users (phone, open_count, last_active_at, created_at, updated_at)
        VALUES ($1, 1, NOW(), NOW(), NOW())
        RETURNING id, phone, open_count, last_active_at, created_at
      `;
      const createResult = await pool.query(createQuery, [phone]);
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(createResult.rows[0]),
      };
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(result.rows[0]),
    };
  } catch (error) {
    console.error("DB Error:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: "Activity update failed",
        message: error.message,
      }),
    };
  } finally {
    await pool.end().catch(console.error);
  }
};
