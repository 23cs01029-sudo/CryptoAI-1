const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://cryptoai-server.onrender.com'
  : '';

export default API_BASE;