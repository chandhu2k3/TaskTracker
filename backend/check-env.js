const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const devEnvPath = path.join(__dirname, '.env.development');
const defaultEnvPath = path.join(__dirname, '.env');

console.log('Checking env files...');
console.log('.env exists:', fs.existsSync(defaultEnvPath));
console.log('.env.development exists:', fs.existsSync(devEnvPath));

if (fs.existsSync(devEnvPath)) {
    dotenv.config({ path: devEnvPath });
    console.log('Loaded .env.development');
} else {
    dotenv.config();
    console.log('Loaded .env (default)');
}

console.log('--- Environment Variables ---');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'EXISTS' : 'MISSING');
console.log('REACT_APP_GOOGLE_CLIENT_ID:', process.env.REACT_APP_GOOGLE_CLIENT_ID ? 'EXISTS' : 'MISSING');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'EXISTS' : 'MISSING');
console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI || 'MISSING');
console.log('FRONTEND_URL:', process.env.FRONTEND_URL || 'MISSING');
