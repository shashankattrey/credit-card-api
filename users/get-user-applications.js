// netlify/functions/get-user-applications.js
const { Pool } = require("pg");

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const userId = event.queryStringParameters?.user_id || 1;

  if (!userId) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "user_id required" }),
    };
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await pool.query(
      `
      SELECT 
        COUNT(*)::int as total,
        json_agg(
          json_build_object(
            'id', ua.id,
            'product_id', ua.product_id,
            'status', ua.status,
            'source', ua.source,
            'date', to_char(ua.created_at, 'YYYY-MM-DD'),
            'partner_id', ua.partner_id
          ) ORDER BY ua.created_at DESC
        ) FILTER (WHERE ua.id IS NOT NULL) as applications
      FROM user_applications ua
      JOIN users u ON u.id = ua.user_id
      LEFT JOIN products p ON p.id = ua.product_id
      WHERE ua.user_id = $1
    `,
      [userId]
    );

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        data: result.rows[0] || { total: 0, applications: [] },
      }),
    };
  } catch (error) {
    console.error("Get applications error:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    await pool.end();
  }
};
