module.exports = {
  service: {
    host: process.env.PAX_CORE_HOST || '0.0.0.0',
    port: parseInt(process.env.PAX_CORE_PORT || '9002', 10)
  },
  adminApi: {
    url: (process.env.PAX_ADMIN_API_URL || 'http://localhost:3000/api/admin').replace(/\/$/, ''),
    serviceKey: process.env.PAX_SERVICE_KEY || ''
  },
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    prettyPrint: process.env.NODE_ENV !== 'production'
  }
};
