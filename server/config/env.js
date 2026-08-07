const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const getJwtSecret = () => required('JWT_SECRET');

const getAllowedOrigins = () => {
  const configured = process.env.CORS_ORIGINS;
  if (!configured) return process.env.NODE_ENV === 'production' ? [] : true;
  return configured.split(',').map((origin) => origin.trim()).filter(Boolean);
};

module.exports = { getJwtSecret, getAllowedOrigins };
