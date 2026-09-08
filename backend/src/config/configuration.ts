import Joi from "joi";
import { fileURLToPath } from "node:url";

export const environmentFiles = [fileURLToPath(new URL("../../../.env", import.meta.url))];

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  PORT: Joi.number().port().required(),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().required(),
  POSTGRES_DB: Joi.string().required(),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  DATABASE_URL: Joi.string().default((config) => {
    const url = new URL("postgres://localhost");
    url.hostname = config.DB_HOST;
    url.port = String(config.DB_PORT);
    url.username = encodeURIComponent(config.POSTGRES_USER);
    url.password = encodeURIComponent(config.POSTGRES_PASSWORD);
    url.pathname = `/${encodeURIComponent(config.POSTGRES_DB)}`;
    return url.toString();
  }),
  DATABASE_SSL: Joi.boolean().truthy("true").falsy("false").default(false),
  DB_POOL_MAX: Joi.number().integer().min(1).default(10),
  DB_POOL_MIN: Joi.number().integer().min(0).default(0),
  DB_POOL_IDLE_MS: Joi.number().integer().min(1000).default(10000),
  DB_POOL_ACQUIRE_MS: Joi.number().integer().min(1000).default(30000),
  SESSION_SECRET: Joi.string().min(32).required(),
  SESSION_COOKIE_SECURE: Joi.boolean().truthy("true").falsy("false").optional(),
  FRONTEND_URL: Joi.string().uri().required(),
  API_PUBLIC_URL: Joi.string().uri().required(),
  TRUST_PROXY: Joi.number().integer().min(0).default(0),
  GOOGLE_CLIENT_ID: Joi.string().allow("").default(""),
  GOOGLE_CLIENT_SECRET: Joi.string().allow("").default(""),
  LOG_LEVEL: Joi.string().default("info"),
}).unknown(true);
