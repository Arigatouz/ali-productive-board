const crypto = require('crypto');

const SECRET = process.env.TOKEN_SECRET || 'change-me-secret';
const PASSWORD = process.env.DASHBOARD_PASSWORD || 'changeme';

function makeToken() {
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
  const payload = `${expires}`;
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  if (sig !== expected) return false;
  if (Date.now() > parseInt(payload)) return false;
  return true;
}

exports.verifyToken = verifyToken;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { password } = JSON.parse(event.body || '{}');

  if (password !== PASSWORD) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Wrong password' }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ token: makeToken() }),
  };
};
