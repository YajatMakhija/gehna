import { loadEnv, defineConfig } from "@medusajs/framework/utils";
loadEnv(process.env.NODE_ENV || "development", process.cwd());
const redisModules = process.env.REDIS_URL ? [
  { resolve: "@medusajs/medusa/event-bus-redis", options: { redisUrl: process.env.REDIS_URL } },
  { resolve: "@medusajs/medusa/cache-redis", options: { redisUrl: process.env.REDIS_URL } },
  { resolve: "@medusajs/medusa/workflow-engine-redis", options: { redis: { redisUrl: process.env.REDIS_URL } } },
  { resolve: "@medusajs/medusa/locking", options: { providers: [{ id: "locking-redis", resolve: "@medusajs/medusa/locking-redis", is_default: true, options: { redisUrl: process.env.REDIS_URL } }] } }
] : [];
const fileModules = process.env.S3_BUCKET && process.env.S3_REGION && process.env.S3_FILE_URL ? [{
  resolve: "@medusajs/medusa/file", options: { providers: [{ id: "s3", resolve: "@medusajs/medusa/file-s3", options: {
    file_url: process.env.S3_FILE_URL, region: process.env.S3_REGION, bucket: process.env.S3_BUCKET,
    access_key_id: process.env.S3_ACCESS_KEY_ID, secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
    endpoint: process.env.S3_ENDPOINT, acl: false,
    additional_client_config: { forcePathStyle: process.env.S3_URL_STYLE === "path" }
  } }] }
}] : [];
module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!, adminCors: process.env.ADMIN_CORS!, authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET!, cookieSecret: process.env.COOKIE_SECRET!
    }
  },
  admin: {
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
    vite: () => ({ server: { allowedHosts: ["localhost", "127.0.0.1", ".up.railway.app", "api.gehnadesigns.in"] } })
  },
  modules: [...redisModules, ...fileModules]
});
