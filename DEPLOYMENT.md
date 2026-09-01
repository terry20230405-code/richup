# Deployment

The application is deployed as two services:

- `richup.frontend`: Vue/Vite single-page application on Cloudflare Workers Static Assets.
- `richup.backend`: Node.js, Express, and Socket.IO web service on Render.

The backend must be deployed first because its public URL is embedded into the frontend during the Vite build.

## 1. Deploy the backend on Render

1. Sign in to Render and choose **New > Blueprint**.
2. Connect the GitHub repository containing this project.
3. Render detects the root `render.yaml` file.
4. Create the Blueprint. It provisions the `richup-backend` free web service and generates `JWT_SECRET` automatically.
5. Wait for the health check at `/api/v1/health` to pass.
6. Copy the service URL, for example `https://richup-backend.onrender.com`.

Equivalent manual Render settings:

| Setting | Value |
| --- | --- |
| Service type | Web Service |
| Runtime | Node |
| Branch | main |
| Root directory | `richup.backend` |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/v1/health` |
| Plan | Free |

Required backend environment variables:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `LOG_LEVEL` | `info` |
| `JWT_SECRET` | A generated long random secret |

Do not manually set `PORT` on Render. Render supplies it to the service.

## 2. Deploy the frontend on Cloudflare

1. In Cloudflare, open **Workers & Pages > Create application > Import a repository**.
2. Select this GitHub repository and the `main` production branch.
3. Use these build settings:

| Setting | Value |
| --- | --- |
| Project name | `richup` |
| Build command | `npm ci --prefix richup.frontend && npm run build --prefix richup.frontend` |
| Deploy command | `npx wrangler deploy` |

4. Add these **Build variables** before the first deployment, replacing the example origin with the real Render URL:

| Variable | Example value |
| --- | --- |
| `VITE_API_BASE_URL` | `https://richup-backend.onrender.com/api/v1` |
| `VITE_SOCKET_URL` | `https://richup-backend.onrender.com` |

5. Deploy the project.

The root `wrangler.jsonc` publishes `richup.frontend/dist` and enables SPA fallback so direct navigation to `/game` returns `index.html` instead of a 404.

## 3. Verify the deployment

1. Open `<backend-origin>/api/v1/health` and confirm that it returns JSON with `"status":"ok"`.
2. Open the Cloudflare URL in two separate browser profiles or devices.
3. Create a room on one device and join it from the other.
4. Start a game and verify that dice rolls and player movement appear on both devices.

## Free-plan limitation

Render can suspend a free web service after it is idle. Because rooms are currently stored in backend memory, rooms are lost whenever the backend process sleeps, restarts, or redeploys. Cloudflare static frontend hosting does not cause this data loss.
