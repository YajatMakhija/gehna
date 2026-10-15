import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const client = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_URL_STYLE === "path",
  credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  } : undefined,
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const key = String(req.params.key || "")
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/.test(key)) {
    return res.status(400).json({ message: "Invalid file key" })
  }

  try {
    const object = await client.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    }))

    if (!object.Body) return res.status(404).end()
    if (object.ContentType) res.setHeader("Content-Type", object.ContentType)
    if (object.ContentLength !== undefined) res.setHeader("Content-Length", String(object.ContentLength))
    res.setHeader("Cache-Control", object.CacheControl || "public, max-age=31536000, immutable")
    res.setHeader("X-Content-Type-Options", "nosniff")

    const body = object.Body as typeof object.Body & { pipe?: (destination: MedusaResponse) => void }
    if (typeof body.pipe === "function") return body.pipe(res)
    return res.send(Buffer.from(await object.Body.transformToByteArray()))
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    if (status === 404) return res.status(404).end()
    req.scope.resolve(ContainerRegistrationKeys.LOGGER).error("Unable to read product image from object storage")
    return res.status(502).json({ message: "Image is temporarily unavailable" })
  }
}
