import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const DEBUG_ENDPOINT = 'http://127.0.0.1:7767/ingest/4c737b99-5e76-49ae-9b21-3069b9fff060'
const SESSION_ID = '58d7e2'

function debugLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  // #region agent log
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
    body: JSON.stringify({ sessionId: SESSION_ID, hypothesisId, location, message, data, timestamp: Date.now(), runId: 'pre-fix' }),
  }).catch(() => { })
  // #endregion
}

// https://vite.dev/config/
export default defineConfig({
  root: "web",
  plugins: [
    {
      name: 'debug-404',
      configureServer(server) {
        const root = server.config.root
        const indexPath = resolve(root, 'index.html')
        const indexExists = existsSync(indexPath)
        // #region agent log
        debugLog('A', 'vite.config.ts:configureServer', 'vite root and index.html check', {
          root,
          indexPath,
          indexExists,
          cwd: process.cwd(),
        })
        // #endregion
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '/index.html') {
            // #region agent log
            debugLog('B', 'vite.config.ts:middleware', 'root request received', {
              url: req.url,
              indexExists,
              statusCode: res.statusCode,
            })
            // #endregion
          }
          next()
        })
      },
    },
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./web/src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url))
    }
  },
  server: {
    //allow import from outside web directory
    fs: { allow: [fileURLToPath(new URL(".", import.meta.url))] }
  }
})
