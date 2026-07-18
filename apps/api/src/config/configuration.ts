/**
 * Central typed configuration, loaded once by @nestjs/config.
 * Access nested values via ConfigService, e.g. config.get('jwt.accessSecret').
 */
export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  // PORT is the conventional platform-injected variable (Railway, Render, Heroku).
  port: parseInt(process.env.API_PORT ?? process.env.PORT ?? '4000', 10),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10),
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL ?? '1209600', 10),
    otpTtl: parseInt(process.env.OTP_TTL ?? '300', 10),
  },

  google: {
    // OAuth client ID used to verify Google Identity Services ID tokens.
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  },

  ai: {
    provider: (process.env.AI_PROVIDER ?? 'anthropic') as 'openai' | 'anthropic',
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    chatModelOpenai: process.env.AI_CHAT_MODEL_OPENAI ?? 'gpt-4o',
    chatModelAnthropic: process.env.AI_CHAT_MODEL_ANTHROPIC ?? 'claude-opus-4-8',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-large',
    embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS ?? '1536', 10),
  },

  storage: {
    provider: (process.env.STORAGE_PROVIDER ?? 'minio') as 'minio' | 's3' | 'r2' | 'filesystem',
    bucket: process.env.STORAGE_BUCKET ?? 'anura-documents',
    region: process.env.STORAGE_REGION ?? 'us-east-1',
    endpoint: process.env.STORAGE_ENDPOINT ?? 'http://localhost:9000',
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? '',
    forcePathStyle: (process.env.STORAGE_FORCE_PATH_STYLE ?? 'true') === 'true',
    publicUrl: process.env.STORAGE_PUBLIC_URL ?? '',
  },

  ocr: {
    provider: (process.env.OCR_PROVIDER ?? 'none') as 'none' | 'textract',
    awsRegion: process.env.AWS_REGION ?? 'ap-south-1',
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },

  whatsapp: {
    provider: (process.env.WHATSAPP_PROVIDER ?? 'log') as 'log' | 'meta',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? 'anura-verify',
    apiVersion: process.env.WHATSAPP_API_VERSION ?? 'v21.0',
  },

  email: {
    provider: (process.env.EMAIL_PROVIDER ?? 'log') as 'log' | 'resend',
    apiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.EMAIL_FROM ?? 'Anura <invoices@anura.legal>',
  },

  payments: {
    provider: (process.env.PAYMENTS_PROVIDER ?? 'none') as 'none' | 'stripe' | 'razorpay',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? '',
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
    gstPercent: parseFloat(process.env.GST_PERCENT ?? '18'),
  },

  notifications: {
    provider: (process.env.NOTIFICATIONS_PROVIDER ?? 'log') as 'log' | 'firebase',
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? '',
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
    firebasePrivateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  },

  ecourts: {
    provider: (process.env.ECOURTS_PROVIDER ?? 'none') as 'none' | 'ecourtsindia',
    apiUrl: process.env.ECOURTS_API_URL ?? 'https://webapi.ecourtsindia.com',
    apiToken: process.env.ECOURTS_API_TOKEN ?? '',
  },
});

export type AppConfig = ReturnType<typeof import('./configuration').default>;
