import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { loadEnv } from "@medusajs/framework/utils"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const server = resolve(root, ".medusa/server")
const cli = resolve(root, "node_modules/@medusajs/cli/cli.js")

if (!existsSync(resolve(server, "public/admin/index.html"))) {
  throw new Error("The Medusa production build is missing. Run `npm run build` before `npm run start`.")
}

process.env.NODE_ENV ||= "production"
loadEnv(process.env.NODE_ENV, root)

const child = spawn(process.execPath, [cli, "start"], {
  cwd: server,
  env: process.env,
  stdio: "inherit",
})

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal))
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
