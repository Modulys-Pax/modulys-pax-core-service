module.exports = {
  service: {
    host: process.env.SERVICE_HOST || '0.0.0.0',
    port: parseInt(process.env.SERVICE_PORT || '9002')
  },
  adminApi: {
    url: process.env.ADMIN_API_URL || 'http://localhost:3000/api/admin',
    serviceKey: process.env.SERVICE_KEY || ''
  },
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    prettyPrint: process.env.NODE_ENV !== 'production'
  }
};
