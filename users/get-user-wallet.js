// netlify/functions/get-user-wallet.js
const { Pool } = require("pg");

exports.handler = async (event) => {
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

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const userId = event.queryStringParameters?.id || 1;

  if (!userId) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "id required" }),
    };
  }

  try {
    const result = await pool.query(
      `
      SELECT 
        cw.balance, cw.available_balance, cw.total_earned, cw.total_withdrawn,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ct.id, 'amount', ct.amount,
              'type', CASE WHEN ct.amount > 0 THEN 'credit' ELSE 'debit' END,
              'date', to_char(ct.created_at, 'YYYY-MM-DD')
            )
          ) FILTER (WHERE ct.id IS NOT NULL), '[]'::json
        ) as transactions
      FROM cashback_wallets cw
      LEFT JOIN cashback_transactions ct ON ct.wallet_id = cw.id
      WHERE cw.user_id = $1
      GROUP BY cw.id, cw.balance, cw.available_balance, cw.total_earned, cw.total_withdrawn
    `,
      [userId]
    );

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        data: result.rows[0] || {
          balance: 0,
          available_balance: 0,
          total_earned: 0,
          total_withdrawn: 0,
          transactions: [],
        },
      }),
    };
  } catch (error) {
    console.error("Wallet error:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    await pool.end();
  }
};
