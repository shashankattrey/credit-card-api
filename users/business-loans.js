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

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const query = `
      SELECT 
        bld.product_id::text AS id,

        COALESCE(p.name, 'Business Loan ' || bld.product_id::text) AS loanName,
        COALESCE(p.name, 'Lender ' || bld.product_id::text) AS bankName,

        lp.loan_type AS variant,

        COALESCE(bld.best_for, 'Business Owners') AS bestFor,

        'Up to ₹' || (lp.max_amount / 100000)::int::text || ' Lakhs' AS maxAmount,

        p.apply_url AS applyUrl,

        COALESCE(p.highlight_tag, 'Popular') AS highlightTag,

        json_build_object(
          'interestRate',
            CASE 
              WHEN lp.interest_rate_min IS NOT NULL 
                AND lp.interest_rate_max IS NOT NULL
              THEN (lp.interest_rate_min * 100)::int::text || '% - ' ||
                   (lp.interest_rate_max * 100)::int::text || '%'
              ELSE NULL
            END
        ) AS fees,

        COALESCE(bld.documents, '[]'::jsonb) AS documents,
        COALESCE(bld.process_steps, '[]'::jsonb) AS process_steps,
        COALESCE(bld.key_facts, '[]'::jsonb) AS key_facts,

        lp.min_amount,
        lp.max_amount,
        lp.max_tenure_months,
        p.description,

        cr.amount_percentage AS cashback_percentage,
        cr.max_amount AS cashback_max_amount

      FROM business_loan_details bld
      LEFT JOIN loan_products lp 
        ON lp.product_id::bigint = bld.product_id
      LEFT JOIN products p 
        ON p.id = bld.product_id::bigint
      LEFT JOIN cashback_rules cr 
        ON cr.product_id = bld.product_id 
       AND cr.is_active = TRUE

      WHERE bld.product_id IS NOT NULL
      ORDER BY lp.interest_rate_min ASC NULLS LAST;
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
