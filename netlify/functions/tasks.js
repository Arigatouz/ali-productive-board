const crypto = require('crypto');

const HACKMD_TOKEN = process.env.HACKMD_API_TOKEN;
const TASKS_NOTE_ID = process.env.TASKS_NOTE_ID || '5XzDpCzbS-qO6WkM3-ljLw';
const SECRET = process.env.TOKEN_SECRET || 'change-me-secret';

function verifyToken(token) {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  if (sig !== expected) return false;
  if (Date.now() > parseInt(payload)) return false;
  return true;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Verify token
  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '');
  if (!verifyToken(token)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // GET — load tasks from HackMD
  if (event.httpMethod === 'GET') {
    const res = await fetch(`https://api.hackmd.io/v1/notes/${TASKS_NOTE_ID}`, {
      headers: { Authorization: `Bearer ${HACKMD_TOKEN}` },
    });
    if (!res.ok) {
      return { statusCode: res.status, headers, body: JSON.stringify({ error: 'Failed to fetch from HackMD' }) };
    }
    const data = await res.json();
    return { statusCode: 200, headers, body: JSON.stringify({ content: data.content }) };
  }

  // PATCH — save tasks to HackMD
  if (event.httpMethod === 'PATCH') {
    const { content } = JSON.parse(event.body || '{}');
    if (!content) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing content' }) };
    }
    const res = await fetch(`https://api.hackmd.io/v1/notes/${TASKS_NOTE_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${HACKMD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });
    return { statusCode: res.status, headers, body: JSON.stringify({ ok: res.status < 300 }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
