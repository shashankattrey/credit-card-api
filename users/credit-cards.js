const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

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

  try {
    const query = `
      SELECT 
        c.product_id::text as id,
        COALESCE(p.name, c.bank_name || ' ' || c.variant) as name,
        c.bank_name,
        c.network,
        c.variant,
        'Nationwide Available' as highlight_tag,
        c.joining_fee,
        c.annual_fee,
        10 as display_priority,
        p.apply_url
      FROM credit_card_products c
      JOIN products p ON p.id = c.product_id
      ORDER BY 
        COALESCE(p.display_priority, 0) DESC NULLS LAST,
        c.joining_fee ASC
      LIMIT 25
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
    await pool.end();
  }
};
