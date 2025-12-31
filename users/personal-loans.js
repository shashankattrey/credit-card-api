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
        lp.product_id::text as id,
        COALESCE(p.name, 'Personal Loan ' || lp.product_id::text) as name,
        COALESCE(p.name, 'Lender ' || lp.product_id::text) as bank_name,
        (lp.interest_rate_min * 100)::int::text || '-' || (lp.interest_rate_max * 100)::int::text || '%' as interestRate,
        '₹ ' || (lp.max_amount / 100000)::int::text || ' Lakhs' as loan_amount,
        json_build_object(
          'partPrepayment', 'Allowed after 6 months',
          'processingFee', '1-2%',
          'foreclosure', '4%',
          'interestRate', (lp.interest_rate_min * 100)::int::text || '-' || (lp.interest_rate_max * 100)::int::text || '%',
          'apr', ((lp.interest_rate_min * 1.1) * 100)::int::text || '-' || ((lp.interest_rate_max * 1.1) * 100)::int::text || '%'
        ) as charges,
        ARRAY['Aadhaar Card', 'PAN Card', 'Salary Slips (3 months)', 'Bank Statements (6 months)']::text[] as documents,
        ARRAY['Instant Apply', 'KYC Verification', 'Credit Check', 'Approval', 'Disbursal']::text[] as process,
        ARRAY['Salaried: 21+ years', 'Min Salary: ₹25,000/month', 'CIBIL: 700+', 'No Collateral']::text[] as key_facts,
        (lp.interest_rate_min + lp.interest_rate_max) / 2 as interest,
        lp.max_amount as amountNumber,
        GREATEST(1, lp.max_tenure_months / 12) as tenureYears,
        1000 as cashback
      FROM loan_products lp
      LEFT JOIN products p ON p.id = lp.product_id::bigint
      WHERE lp.loan_type ILIKE '%personal%' OR lp.loan_type = 'personal'
      ORDER BY lp.interest_rate_min ASC NULLS LAST, lp.max_amount DESC NULLS LAST
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
        "Access-Control-Allow-Methods": "GET,OPTIONS",
      },
      body: JSON.stringify(data.rows || []),
    };
  } catch (error) {
    console.error("Function error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Failed to fetch loans",
        details: error.message,
      }),
    };
  }
};
