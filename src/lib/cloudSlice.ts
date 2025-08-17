8:32:45 PM: Netlify Build                                                 
8:32:45 PM: ────────────────────────────────────────────────────────────────
8:32:45 PM: ​
8:32:45 PM: ❯ Version
8:32:45 PM:   @netlify/build 35.1.0
8:32:45 PM: ​
8:32:45 PM: ❯ Flags
8:32:45 PM:   accountId: 6896eac9245eab085e646334
8:32:45 PM:   baseRelDir: true
8:32:45 PM:   buildId: 68a1af931d19bc000813570c
8:32:45 PM:   deployId: 68a1af931d19bc000813570e
8:32:45 PM: ​
8:32:45 PM: ❯ Current directory
8:32:45 PM:   /opt/build/repo
8:32:45 PM: ​
8:32:45 PM: ❯ Config file
8:32:45 PM:   /opt/build/repo/netlify.toml
8:32:45 PM: ​
8:32:45 PM: ❯ Context
8:32:45 PM:   production
8:32:45 PM: ​
8:32:45 PM: build.command from netlify.toml                               
8:32:45 PM: ────────────────────────────────────────────────────────────────
8:32:45 PM: ​
8:32:45 PM: $ vite build
8:32:45 PM: vite v5.4.19 building for production...
8:32:46 PM: transforming...
8:32:46 PM: ✓ 28 modules transformed.
8:32:46 PM: x Build failed in 772ms
8:32:46 PM: error during build:
8:32:46 PM: Could not resolve "./lib/cloudSlice" from "src/lib/FarmContext.tsx"
8:32:46 PM: file: /opt/build/repo/src/lib/FarmContext.tsx
8:32:46 PM:     at getRollupError (file:///opt/build/repo/node_modules/rollup/dist/es/shared/parseAst.js:401:41)
8:32:46 PM:     at error (file:///opt/build/repo/node_modules/rollup/dist/es/shared/parseAst.js:397:42)
8:32:46 PM:     at ModuleLoader.handleInvalidResolvedId (file:///opt/build/repo/node_modules/rollup/dist/es/shared/node-entry.js:21490:24)
8:32:46 PM:     at file:///opt/build/repo/node_modules/rollup/dist/es/shared/node-entry.js:21450:26
8:32:46 PM: ​
8:32:46 PM: "build.command" failed                                        
8:32:46 PM: ────────────────────────────────────────────────────────────────
8:32:46 PM: ​
8:32:46 PM:   Error message
8:32:46 PM:   Command failed with exit code 1: vite build (https://ntl.fyi/exit-code-1)
8:32:46 PM: ​
8:32:46 PM:   Error location
8:32:46 PM:   In build.command from netlify.toml:
8:32:46 PM:   vite build
8:32:46 PM: ​
8:32:46 PM:   Resolved config
8:32:46 PM:   build:
8:32:46 PM:     command: vite build
8:32:46 PM:     commandOrigin: config
8:32:46 PM:     environment:
8:32:46 PM:       - AUTH_JWT_SECRET
8:32:46 PM:       - NETLIFY_AUTH_TOKEN
8:32:46 PM:       - NETLIFY_SITE_ID
8:32:46 PM:       - NODE_VERSION
8:32:46 PM:       - SECRETS_SCAN_OMIT_KEYS
8:32:46 PM:     publish: /opt/build/repo/dist
8:32:46 PM:     publishOrigin: config
8:32:46 PM:   functions:
8:32:46 PM:     "*":
8:32:46 PM:       external_node_modules:
8:32:46 PM:         - jsonwebtoken
8:32:46 PM:         - "@netlify/blobs"
8:32:46 PM:         - resend
8:32:46 PM:         - bcryptjs
8:32:46 PM:       node_bundler: esbuild
8:32:46 PM:     cron-reminders:
8:32:46 PM:       schedule: 0 21 * * *
8:32:46 PM:   functionsDirectory: /opt/build/repo/netlify/functions
8:32:46 PM:   redirects:
8:32:47 PM: Failed during stage 'building site': Build script returned non-zero exit code: 2 (https://ntl.fyi/exit-code-2)
8:32:47 PM:     - from: /*
      status: 200
      to: /index.html
  redirectsOrigin: config
8:32:47 PM: Build failed due to a user error: Build script returned non-zero exit code: 2
8:32:47 PM: Failing build: Failed to build site
8:32:47 PM: Finished processing build request in 13.845s
