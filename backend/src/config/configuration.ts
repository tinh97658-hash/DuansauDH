import Joi from "joi";

export const environmentFiles = process.env.CONFIG_FILE
  ? [process.env.CONFIG_FILE]
  : ["config.env", "../.env", ".env"];

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  PORT: Joi.number().port().default(3001),
  DATABASE_URL: Joi.string().required(),
  DATABASE_SSL: Joi.boolean().truthy("true").falsy("false").default(false),
  DB_POOL_MAX: Joi.number().integer().min(1).default(10),
  DB_POOL_MIN: Joi.number().integer().min(0).default(0),
  DB_POOL_IDLE_MS: Joi.number().integer().min(1000).default(10000),
  DB_POOL_ACQUIRE_MS: Joi.number().integer().min(1000).default(30000),
  SESSION_SECRET: Joi.string().min(32).required(),
  SESSION_COOKIE_SECURE: Joi.boolean().truthy("true").falsy("false").optional(),
  FRONTEND_URL: Joi.string().uri().default("http://localhost:3000"),
  API_PUBLIC_URL: Joi.string().uri().default("http://localhost:3000/api"),
  TRUST_PROXY: Joi.number().integer().min(0).default(0),
  GOOGLE_CLIENT_ID: Joi.string().allow("").default(""),
  GOOGLE_CLIENT_SECRET: Joi.string().allow("").default(""),
  LOG_LEVEL: Joi.string().default("info"),
}).unknown(true);
