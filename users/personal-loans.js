// netlify/functions/personal-loans.js
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
    connectionString: process.env.DATABASE_URL, // ✅ Your working env var
    ssl: { rejectUnauthorized: false },
  });

  try {
    const query = `
      SELECT 
        pld.product_id::text as id,
        COALESCE(p.name, 'Personal Loan ' || pld.product_id::text) as name,
        COALESCE(p.name, 'Lender ' || pld.product_id::text) as bank_name,
        COALESCE(p.highlight_tag, 'Best Rate') as highlight_tag,
        
        (lp.interest_rate_min * 100)::int::text || '-' || (lp.interest_rate_max * 100)::int::text || '%' as interestRate,
        
        '₹' || (lp.min_amount / 100000)::int::text || '-' || (lp.max_amount / 100000)::int::text || ' Lakhs' as loan_amount,
        
        json_build_object(
          'partPrepayment', COALESCE(pld.part_prepayment, 'N/A'),
          'processingFee', COALESCE(pld.processing_fee, 'N/A'),
          'foreclosure', COALESCE(pld.foreclosure, 'N/A'),
          'interest_rate', COALESCE(pld.interest_rate, 'N/A'),
          'apr', COALESCE(pld.apr, 'N/A')
        ) as charges,
        
        COALESCE(pld.documents, '[]'::jsonb) as documents,
        COALESCE(pld.process_steps, '[]'::jsonb) as process_steps,
        COALESCE(pld.key_facts, '[]'::jsonb) as key_facts,
        
        lp.loan_type,
        lp.min_amount,
        lp.max_amount,
        lp.max_tenure_months,
        p.apply_url,
        p.description
        
      FROM personal_loan_details pld
      LEFT JOIN loan_products lp ON lp.product_id::bigint = pld.product_id
      LEFT JOIN products p ON p.id = pld.product_id::bigint
      WHERE pld.product_id IS NOT NULL 
        AND pld.part_prepayment IS NOT NULL
      ORDER BY lp.interest_rate_min ASC NULLS LAST
      ;
    `;

    const result = await pool.query(query);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify(result.rows), // ✅ Direct array like your credit-cards
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
    // ✅ SAME WORKING PATTERN
    await pool.end().catch(console.error);
  }
};
