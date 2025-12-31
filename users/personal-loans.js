// netlify/functions/personal-loans.js
exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

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
      LIMIT 5;
    `;

    const response = await fetch(process.env.NEON_DATABASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NEON_API_KEY}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Database error: ${response.status}`);
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
      },
      body: JSON.stringify({
        success: true,
        data: data.rows || [],
        count: data.rows?.length || 0,
      }),
    };
  } catch (error) {
    console.error("Function error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: false,
        error: "Failed to fetch personal loans",
        details: error.message,
      }),
    };
  }
};
