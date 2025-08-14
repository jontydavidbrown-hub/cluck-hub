# Netlify Functions Folder (Drop-in)

This folder is ready to drop into your project root as `netlify/`.

**Structure**
```
netlify/
  functions/
    auth.ts
```

**Requirements**
- Root `netlify.toml` should include:
  ```toml
  [build]
    command = "npm run build"
    publish = "dist"
    functions = "netlify/functions"

  [functions]
    node_bundler = "esbuild"
    external_node_modules = ["@netlify/blobs","bcryptjs","jsonwebtoken"]

  [[redirects]]
    from = "/.netlify/functions/*"
    to = "/.netlify/functions/:splat"
    status = 200
    force = true

  [[redirects]]
    from = "/*"
    to = "/index.html"
    status = 200
  ```

- Root `package.json` should have (for local typings):
  ```json
  {
    "devDependencies": {
      "@netlify/functions": "^2.0.0"
    },
    "dependencies": {
      "@netlify/blobs": "^6.7.0",
      "bcryptjs": "^2.4.3",
      "jsonwebtoken": "^9.0.2"
    }
  }
  ```

**Environment vars (Netlify UI > Site Settings > Environment)**
- `AUTH_JWT_SECRET` (required) – a long random string
- Optional if running outside Netlify:
  - `NETLIFY_SITE_ID`
  - `NETLIFY_AUTH_TOKEN`
  - `BLOB_STORE` (defaults to `cluckhub`)

**Smoke test (after deploy)**
Visit: `https://<your-site>/.netlify/functions/auth?action=ping` → should return `{ ok: true }`.
