// netlify/functions/track-category-click.js
// ✅ EXACT SAME PATTERN - pg Pool (NO PRISMA)

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

  // ✅ SAME WORKING PATTERN - NEW pool per request (Neon PG)
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const body = JSON.parse(event.body);
    const { phone, event_type, category_name, category_type, screen_name } =
      body;

    // 🔥 Validate required fields
    if (!phone || !category_name || event_type !== "category_clicked") {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    // ✅ INSERT CLICK (your analytics table)
    const insertQuery = `
      INSERT INTO category_clicks (
        phone, event_type, category_name, category_type, screen_name
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, phone, category_name, category_type, timestamp
    `;

    const result = await pool.query(insertQuery, [
      phone.trim(),
      event_type,
      category_name.trim(),
      category_type?.trim() || "unknown",
      screen_name?.trim() || null,
    ]);

    console.log(
      `✅ TRACKED: ${phone} → ${category_name} (ID: ${result.rows[0].id})`
    );

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        id: result.rows[0].id,
        category: result.rows[0].category_name,
      }),
    };
  } catch (error) {
    console.error("DB Error:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: "Tracking failed",
        message: error.message,
      }),
    };
  } finally {
    await pool.end().catch(console.error);
  }
};
