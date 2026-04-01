const IS_PROD = !window.location.hostname.includes('localhost');
export const API_BASE = IS_PROD ? 'https://uips-backend.onrender.com' : 'http://localhost:5000';
