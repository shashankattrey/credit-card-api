const { Pool } = require('pg');
const admin = require('firebase-admin');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { phone, fcm_token } = JSON.parse(event.body);

  if (!phone || !fcm_token) {
    return { 
      statusCode: 400, 
      body: JSON.stringify({ error: 'Missing phone or fcm_token' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
      });
    }

    let userResult = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
    let userId;
    if (userResult.rows.length === 0) {
      const insertResult = await pool.query(
        'INSERT INTO users (phone, created_at) VALUES ($1, NOW()) RETURNING id', 
        [phone]
      );
      userId = insertResult.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
    }

    const activeChallenge = await pool.query(
      'SELECT challenge_id FROM push_challenges WHERE user_id = $1 AND expires_at > NOW()',
      [userId]
    );
    
    if (activeChallenge.rows.length > 0) {
      return { 
        statusCode: 400,
        body: JSON.stringify({ error: 'Challenge already active' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const challengeId = `CHLG_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await pool.query(
      'INSERT INTO push_challenges (user_id, challenge_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'90 seconds\')',
      [userId, challengeId]
    );

    try {
      await admin.messaging().send({
        token: fcm_token,
        notification: { 
          title: 'Login Challenge', 
          body: `Your challenge: ${challengeId}` 
        },
        data: { challenge_id: challengeId }
      });
    } catch (pushError) {
      console.error('Push failed:', pushError.message);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        challenge_id: challengeId,
        expires_in: 90,
        status: 'push_sent'
      }),
      headers: { 'Content-Type': 'application/json' }
    };

  } catch (error) {
    console.error('Error:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }),
      headers: { 'Content-Type': 'application/json' }
    };
  } finally {
    await pool.end();
  }
};
