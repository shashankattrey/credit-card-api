// netlify/functions/get-user-profile.js
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
        u.id, 
        u.phone,
        up.full_name,
        up.dob, 
        up.pincode, 
        up.kyc_status,
        CASE 
          WHEN up.kyc_status = 'completed' THEN true
          WHEN up.kyc_status = 'pending' THEN false
          ELSE false
        END AS kyc_completed,
        up.employment_type, 
        up.annual_income
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = $1
    `,
      [userId]
    );

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        profile: result.rows[0] || null,
        kyc_complete: result.rows[0]?.kyc_status === "completed",
      }),
    };
  } catch (error) {
    console.error("Get profile error:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    await pool.end();
  }
};
