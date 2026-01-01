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

  // Create NEW pool per request (Netlify serverless)
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const query = `
      SELECT 
        c.product_id::text AS id,
        COALESCE(p.name, c.bank_name || ' ' || c.variant) AS name,
        c.bank_name,
        c.network,
        c.variant,
        p.highlight_tag,
        c.joining_fee,
        c.annual_fee,
        COALESCE(cr.amount_flat, 0) AS cashback_amount, -- Flat cashback
        10 AS display_priority,
        p.apply_url
      FROM credit_card_products c
      JOIN products p ON p.id = c.product_id
      LEFT JOIN cashback_rules cr 
        ON cr.product_id = c.product_id 
       AND cr.is_active = true
      ORDER BY 
        COALESCE(p.display_priority, 0) DESC NULLS LAST,
        c.joining_fee ASC
      LIMIT 25;
    `;

    const result = await pool.query(query);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify(result.rows),
    };
  } catch (error) {
    console.error("DB Error:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: "Database connection failed",
        message: error.message,
      }),
    };
  } finally {
    await pool.end().catch(console.error);
  }
};
