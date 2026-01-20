import { Handler } from '@netlify/functions';
import { Pool } from 'pg';
import admin from 'firebase-admin';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')
    )
  });
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'POST only' };
  }

  try {
    const { phone, fcm_token }: { phone: string; fcm_token: string } = JSON.parse(event.body || '{}');
    
    if (!phone || !/^\d{10}$/.test(phone)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid phone' }) };
    }

    // Check user exists
    const userResult = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (userResult.rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
    }

    const userId = userResult.rows[0].id;
    
    // Create challenge
    const challengeId = `CHLG_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await pool.query(
      'INSERT INTO push_challenges (user_id, challenge_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'90 seconds\')',
      [userId, challengeId]
    );

    // Send push notification
    await admin.messaging().send({
      token: fcm_token,
      notification: {
        title: 'Login to Paisa Dekho',
        body: 'Tap to approve login (90s)'
      },
      data: { challenge_id: challengeId, action: 'login_approve' }
    });

    return {
      statusCode: 200,
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        challenge_id: challengeId, 
        expires_in: 90,
        status: 'push_sent' 
      })
    };
  } catch (error) {
    console.error('Push login error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Server error' })
    };
  }
};
