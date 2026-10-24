import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const base = "http://127.0.0.1:9000"
const storefrontEnv = Object.fromEntries(
  readFileSync("storefront/.env.local", "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf("=")
      return [line.slice(0, separator), line.slice(separator + 1)]
    })
)
const credentials = JSON.parse(readFileSync(".local/admin-credentials.json", "utf8"))

async function request(path, { method = "GET", body, token, publishable = false, expected } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (publishable) headers["x-publishable-api-key"] = storefrontEnv.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
  if (body !== undefined && !(body instanceof FormData)) headers["Content-Type"] = "application/json"
  const response = await fetch(base + path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
  })
  const data = await response.json().catch(() => ({}))
  if (expected !== undefined) {
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`)
  } else if (!response.ok) {
    throw new Error(`${method} ${path} ${response.status}: ${JSON.stringify(data)}`)
  }
  return { response, data }
}

const { data: login } = await request("/auth/user/emailpass", { method: "POST", body: credentials })
const token = login.token
const sku = `GEH-QA-${Date.now()}`
const handle = `dashboard-qa-${Date.now()}`
let productId
const uploadIds = []

try {
  const [{ data: profiles }, { data: channels }, { data: locations }] = await Promise.all([
    request("/admin/shipping-profiles", { token }),
    request("/admin/sales-channels", { token }),
    request("/admin/stock-locations", { token }),
  ])
  const profile = profiles.shipping_profiles.find((item) => item.type === "default")
  const channel = channels.sales_channels.find((item) => item.name === "Gehna Online Store") || channels.sales_channels[0]
  const location = locations.stock_locations.find((item) => item.name === "Gehna Studio") || locations.stock_locations[0]
  assert(profile && channel && location, "Medusa product prerequisites are missing")

  const created = await request("/admin/products", {
    method: "POST",
    token,
    body: {
      title: "Dashboard QA Product",
      handle,
      status: "published",
      description: "Temporary product created by the dashboard deployment check.",
      shipping_profile_id: profile.id,
      sales_channels: [{ id: channel.id }],
      options: [{ title: "Size", values: ["One size"] }],
      variants: [{
        title: "One size",
        sku,
        manage_inventory: true,
        allow_backorder: false,
        options: { Size: "One size" },
        prices: [{ currency_code: "inr", amount: 1499 }],
      }],
    },
  })
  productId = created.data.product.id

  const image = new FormData()
  image.append("files", new Blob([readFileSync("storefront/public/images/necklace.png")], { type: "image/png" }), "dashboard-qa.png")
  image.append("files", new Blob([readFileSync("storefront/public/images/jhumkas.png")], { type: "image/png" }), "dashboard-qa-second.png")
  const uploaded = await request("/admin/uploads", { method: "POST", token, body: image })
  const uploadedFile = uploaded.data.files?.[0]
  assert(uploadedFile?.url, "Admin image upload did not return a URL")
  uploadIds.push(...uploaded.data.files.map(file => file.id))
  assert.equal(uploadIds.length, 2, "Both gallery images must upload")
  const downloaded = await fetch(uploadedFile.url)
  assert.equal(downloaded.status, 200, "Uploaded product image is not publicly readable")
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), readFileSync("storefront/public/images/necklace.png"), "Uploaded image bytes changed")

  const details = await request(`/admin/products/${productId}?fields=*variants,*variants.prices`, { token })
  const variant = details.data.product.variants[0]
  const price = variant.prices.find((item) => item.currency_code === "inr")
  assert(price, "Created product is missing its INR price")

  await request(`/admin/products/${productId}`, {
    method: "POST",
    token,
    body: { title: "Dashboard QA Product Updated", thumbnail: uploadedFile.url, images: uploaded.data.files.map(file => ({ url: file.url })) },
  })
  const gallery = await request(`/admin/products/${productId}?fields=*images`, { token })
  const reordered = [...gallery.data.product.images].reverse()
  await request(`/admin/products/${productId}`, {
    method: "POST", token,
    body: { thumbnail: reordered[0].url, images: reordered.map(({ id, url }) => ({ id, url })) },
  })
  await request(`/admin/products/${productId}/variants/${variant.id}`, {
    method: "POST",
    token,
    body: { prices: [{ id: price.id, currency_code: "inr", amount: 1599 }] },
  })

  const inventoryList = await request(`/admin/inventory-items?sku=${encodeURIComponent(sku)}&fields=id,sku`, { token })
  const inventoryItem = inventoryList.data.inventory_items?.[0]
  assert(inventoryItem, "Created variant is missing its inventory item")
  await request(`/admin/inventory-items/${inventoryItem.id}/location-levels`, {
    method: "POST",
    token,
    body: { location_id: location.id, stocked_quantity: 7 },
  })
  await request(`/admin/inventory-items/${inventoryItem.id}/location-levels/${location.id}`, {
    method: "POST",
    token,
    body: { stocked_quantity: 9 },
  })

  const storeProduct = await request(
    `/store/products/${productId}?region_id=${storefrontEnv.NEXT_PUBLIC_MEDUSA_REGION_ID}&fields=title,thumbnail,*images,*variants.calculated_price,variants.inventory_quantity`,
    { publishable: true }
  )
  assert.equal(storeProduct.data.product.title, "Dashboard QA Product Updated")
  assert.equal(storeProduct.data.product.thumbnail, reordered[0].url)
  assert.deepEqual(storeProduct.data.product.images.map(image => image.url), reordered.map(image => image.url), "Storefront must receive the saved gallery order")
  assert.equal(storeProduct.data.product.variants[0].calculated_price.calculated_amount, 1599)
  assert.equal(storeProduct.data.product.variants[0].inventory_quantity, 9)

  await request(`/admin/products/${productId}`, { method: "DELETE", token })
  await request(`/admin/products/${productId}`, { token, expected: 404 })
  productId = undefined
  console.log("Dashboard product create, image upload, gallery reorder, cover change, price update, inventory update, storefront sync and delete passed.")
} finally {
  if (productId) {
    await request(`/admin/products/${productId}`, { method: "DELETE", token }).catch(() => undefined)
  }
  for (const uploadId of uploadIds) await request(`/admin/uploads/${uploadId}`, { method: "DELETE", token }).catch(() => undefined)
}
