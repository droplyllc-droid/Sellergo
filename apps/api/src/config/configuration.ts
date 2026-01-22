import * as Joi from 'joi';

export const configuration = () => ({
  // Server
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',

  // Database
  database: {
    url: process.env['DATABASE_URL'],
  },

  // Redis
  redis: {
    url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    password: process.env['REDIS_PASSWORD'],
  },

  // JWT
  jwt: {
    secret: process.env['JWT_SECRET'],
    accessTokenExpiry: process.env['JWT_ACCESS_EXPIRY'] ?? '15m',
    refreshTokenExpiry: process.env['JWT_REFRESH_EXPIRY'] ?? '7d',
    issuer: 'sellergo.shop',
    audience: 'sellergo-api',
  },

  // Security
  security: {
    bcryptRounds: parseInt(process.env['BCRYPT_ROUNDS'] ?? '12', 10),
    maxLoginAttempts: parseInt(process.env['MAX_LOGIN_ATTEMPTS'] ?? '5', 10),
    lockoutDurationMinutes: parseInt(process.env['LOCKOUT_DURATION'] ?? '30', 10),
    passwordMinLength: 12,
    mfaIssuer: 'Sellergo',
  },

  // Rate limiting
  rateLimit: {
    global: parseInt(process.env['RATE_LIMIT_GLOBAL'] ?? '100', 10),
    auth: parseInt(process.env['RATE_LIMIT_AUTH'] ?? '10', 10),
    uploads: parseInt(process.env['RATE_LIMIT_UPLOADS'] ?? '20', 10),
  },

  // Stripe
  stripe: {
    secretKey: process.env['STRIPE_SECRET_KEY'],
    webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'],
    publishableKey: process.env['STRIPE_PUBLISHABLE_KEY'],
  },

  // Email
  email: {
    from: process.env['EMAIL_FROM'] ?? 'noreply@sellergo.shop',
    provider: process.env['EMAIL_PROVIDER'] ?? 'smtp',
    smtp: {
      host: process.env['SMTP_HOST'],
      port: parseInt(process.env['SMTP_PORT'] ?? '587', 10),
      secure: process.env['SMTP_SECURE'] === 'true',
      user: process.env['SMTP_USER'],
      password: process.env['SMTP_PASSWORD'],
    },
  },

  // Storage
  storage: {
    provider: process.env['STORAGE_PROVIDER'] ?? 's3',
    bucket: process.env['STORAGE_BUCKET'] ?? 'sellergo-uploads',
    region: process.env['STORAGE_REGION'] ?? 'eu-west-1',
    accessKeyId: process.env['AWS_ACCESS_KEY_ID'],
    secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'],
    cdnUrl: process.env['CDN_URL'],
  },

  // App URLs
  urls: {
    app: process.env['APP_URL'] ?? 'https://sellergo.shop',
    api: process.env['API_URL'] ?? 'https://api.sellergo.shop',
    storefront: process.env['STOREFRONT_URL'] ?? 'https://*.sellergo.shop',
  },

  // Feature flags
  features: {
    mfaEnabled: process.env['FEATURE_MFA'] !== 'false',
    oauthEnabled: process.env['FEATURE_OAUTH'] !== 'false',
    webhooksEnabled: process.env['FEATURE_WEBHOOKS'] !== 'false',
    analyticsEnabled: process.env['FEATURE_ANALYTICS'] !== 'false',
  },
});

// Environment validation schema
export const validationSchema = Joi.object({
  // Required in production
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),

  // Database - required
  DATABASE_URL: Joi.string().required(),

  // Redis - required in production
  REDIS_URL: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  // JWT - required
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),

  // Stripe - required in production
  STRIPE_SECRET_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  STRIPE_WEBHOOK_SECRET: Joi.string().optional(),

  // Optional configurations
  CORS_ORIGINS: Joi.string().optional(),
  RATE_LIMIT_GLOBAL: Joi.number().default(100),
  RATE_LIMIT_AUTH: Joi.number().default(10),
});

export type AppConfig = ReturnType<typeof configuration>;
