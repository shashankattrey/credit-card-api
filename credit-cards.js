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

  const { pincode } = event.queryStringParameters || {};

  try {
    const query = `
      SELECT 
        c.product_id::text as id,
        COALESCE(p.name, c.bank_name || ' ' || c.variant) as name,
        c.bank_name,
        c.network,
        c.variant,
        CASE 
          WHEN ppe.pincode = $1 THEN 'Available in your city'
          WHEN $1 LIKE '302%' THEN 'Jaipur Available'
          ELSE 'Limited availability'
        END as highlight_tag,
        c.joining_fee,
        c.annual_fee,
        CASE WHEN ppe.pincode = $1 OR $1 LIKE '302%' THEN 10 ELSE 5 END as display_priority,
        p.apply_url
      FROM credit_card_products c
      JOIN products p ON p.id = c.product_id
      LEFT JOIN product_pincode_eligibility ppe ON ppe.product_id = p.id AND (ppe.pincode = $1 OR $1 IS NULL)
      ORDER BY 
        CASE WHEN ppe.pincode = $1 OR $1 LIKE '302%' THEN 1 ELSE 2 END,
        COALESCE(p.display_priority, 0) DESC NULLS LAST,
        c.joining_fee ASC
      LIMIT 25
    `;

    const result = await pool.query(query, [pincode || "302017"]);

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
