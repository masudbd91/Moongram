function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32 || secret === 'dev-secret')) {
    throw new Error('JWT_SECRET must be set to a unique secret of at least 32 characters in production');
  }
  return secret || 'dev-secret';
}

module.exports = { getJwtSecret };