// Node.js keep-alive script for Vercel serverless
const https = require('https');

const URL = 'https://task-tracker-gilt-three.vercel.app/api/health'; // Change to your backend URL

function ping() {
  https.get(URL, (res) => {
    console.log(`[${new Date().toISOString()}] Pinged: ${URL} - Status: ${res.statusCode}`);
  }).on('error', (e) => {
    console.error(`[${new Date().toISOString()}] Ping error:`, e.message);
  });
}

// Ping every 5 minutes
setInterval(ping, 5 * 60 * 1000);

// Initial ping
ping();
