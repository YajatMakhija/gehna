import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateRegionsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"

const positiveNumber = (name: string, developmentDefault?: number) => {
  const raw = process.env[name] || (developmentDefault === undefined ? "" : String(developmentDefault))
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be set to a valid non-negative number.`)
  }
  return value
}

export default async function seed({ container }: ExecArgs) {
  const production = process.env.NODE_ENV === "production"
  const includeSamples = process.env.SEED_SAMPLE_CATALOG !== "false" && !production
  const shippingRate = positiveNumber("STANDARD_SHIPPING_RATE_INR", production ? undefined : 80)

  if (production && !process.env.WAREHOUSE_ADDRESS_LINE_1) {
    throw new Error("WAREHOUSE_ADDRESS_LINE_1 is required for the production stock location.")
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const storeService = container.resolve(Modules.STORE)
  const sales = container.resolve(Modules.SALES_CHANNEL)
  const regions = container.resolve(Modules.REGION)
  const locations = container.resolve(Modules.STOCK_LOCATION)
  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const productService = container.resolve(Modules.PRODUCT)
  const keys = container.resolve(Modules.API_KEY)

  let [channel] = await sales.listSalesChannels({ name: "Gehna Online Store" })
  if (!channel) {
    const result = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: "Gehna Online Store" }] },
    })
    channel = result.result[0]
  }

  const [store] = await storeService.listStores()
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        name: "Gehna",
        supported_currencies: [{ currency_code: "inr", is_default: true }],
        default_sales_channel_id: channel.id,
      },
    },
  })

  let [region] = await regions.listRegions({ name: "India" })
  if (!region) {
    const result = await createRegionsWorkflow(container).run({
      input: {
        regions: [{
          name: "India",
          currency_code: "inr",
          countries: ["in"],
          automatic_taxes: false,
          payment_providers: ["pp_system_default"],
        }],
      },
    })
    region = result.result[0]
  } else {
    await updateRegionsWorkflow(container).run({
      input: { selector: { id: region.id }, update: { payment_providers: ["pp_system_default"] } },
    })
  }

  let [location] = await locations.listStockLocations({ name: "Gehna Studio" })
  if (!location) {
    const result = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [{
          name: "Gehna Studio",
          address: {
            country_code: "in",
            address_1: process.env.WAREHOUSE_ADDRESS_LINE_1 || "Local development studio",
            city: process.env.WAREHOUSE_CITY,
            province: process.env.WAREHOUSE_STATE,
            postal_code: process.env.WAREHOUSE_POSTAL_CODE,
          },
        }],
      },
    })
    location = result.result[0]
    await linkSalesChannelsToStockLocationWorkflow(container).run({ input: { id: location.id, add: [channel.id] } })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
  }

  await updateStoresWorkflow(container).run({
    input: { selector: { id: store.id }, update: { default_location_id: location.id } },
  })

  let [profile] = await fulfillment.listShippingProfiles({ type: "default" })
  if (!profile) {
    const result = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: "Default", type: "default" }] },
    })
    profile = result.result[0]
  }

  let [set] = await fulfillment.listFulfillmentSets(
    { name: "Gehna deliveries" },
    { relations: ["service_zones"] }
  )
  if (!set) {
    set = await fulfillment.createFulfillmentSets({
      name: "Gehna deliveries",
      type: "shipping",
      service_zones: [{ name: "India", geo_zones: [{ type: "country", country_code: "in" }] }],
    })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: set.id },
    })
  }

  const existingOptions = await fulfillment.listShippingOptions({ name: "Standard delivery" })
  if (!existingOptions.length) {
    await createShippingOptionsWorkflow(container).run({
      input: [{
        name: "Standard delivery",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: set.service_zones[0].id,
        shipping_profile_id: profile.id,
        type: { label: "Standard", description: "Tracked delivery across serviceable Indian postcodes", code: "standard" },
        prices: [{ currency_code: "inr", amount: shippingRate }, { region_id: region.id, amount: shippingRate }],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      }],
    })
  }

  if (includeSamples) {
    const imageBase = process.env.STOREFRONT_URL || "http://localhost:3000"
    const catalog = [
      { name: "Gul Jhumka Earrings", handle: "gul-jhumka-earrings", category: "Earrings", image: "jhumkas.png", price: 2490, stock: 12, sku: "GEH-GUL-001", subtitle: "A little tradition. A little statement." },
      { name: "Noor Layered Necklace", handle: "noor-layered-necklace", category: "Necklaces", image: "necklace.png", price: 1890, stock: 18, sku: "GEH-NOOR-001", subtitle: "Your everyday, with a little more gold." },
    ]

    for (const item of catalog) {
      let [category] = await productService.listProductCategories({ name: item.category })
      if (!category) {
        const result = await createProductCategoriesWorkflow(container).run({
          input: { product_categories: [{ name: item.category, is_active: true }] },
        })
        category = result.result[0]
      }
      const existing = await productService.listProducts({ handle: item.handle })
      if (existing.length) continue

      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [{
            title: item.name,
            handle: item.handle,
            subtitle: item.subtitle,
            description: "An illustrative sample from the Gehna collection. Photography, price and stock are for development. Replace with actual product details, materials and dimensions before launch.",
            status: ProductStatus.PUBLISHED,
            category_ids: [category.id],
            shipping_profile_id: profile.id,
            thumbnail: `${imageBase}/images/${item.image}`,
            images: [{ url: `${imageBase}/images/${item.image}` }],
            sales_channels: [{ id: channel.id }],
            metadata: { sample_product: true },
            options: [{ title: "Size", values: ["One size"] }],
            variants: [{
              title: "One size",
              sku: item.sku,
              manage_inventory: true,
              allow_backorder: false,
              options: { Size: "One size" },
              prices: [{ currency_code: "inr", amount: item.price }],
            }],
          }],
        },
      })

      const { data: variants } = await query.graph({
        entity: "product_variant",
        fields: ["id", "inventory_items.inventory_item_id"],
        filters: { product_id: result[0].id },
      })
      for (const variant of variants) {
        for (const inventoryItem of variant.inventory_items || []) {
          await createInventoryLevelsWorkflow(container).run({
            input: {
              inventory_levels: [{
                inventory_item_id: inventoryItem.inventory_item_id,
                location_id: location.id,
                stocked_quantity: item.stock,
              }],
            },
          })
        }
      }
    }
  }

  let [key] = await keys.listApiKeys({ title: "Gehna Storefront" })
  if (!key) {
    const result = await createApiKeysWorkflow(container).run({
      input: { api_keys: [{ title: "Gehna Storefront", type: "publishable", created_by: "" }] },
    })
    key = result.result[0]
    await linkSalesChannelsToApiKeyWorkflow(container).run({ input: { id: key.id, add: [channel.id] } })
  }

  if (!production) {
    const env = [
      "NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000",
      `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${key.token}`,
      `NEXT_PUBLIC_MEDUSA_REGION_ID=${region.id}`,
      "NEXT_PUBLIC_MEDUSA_ADMIN_URL=http://localhost:9000/app",
      "NEXT_PUBLIC_DEMO_MODE=false",
      "NEXT_PUBLIC_SAMPLE_CATALOG=true",
      "",
    ].join("\n")
    writeFileSync(resolve(process.cwd(), "../storefront/.env.local"), env)
  }

  logger.info(`Gehna store configuration is ready. Region ID: ${region.id}`)
  logger.info(`Storefront publishable key: ${key.token}`)
  logger.info(includeSamples ? "Development sample catalog is ready." : "No sample products were created.")
}
