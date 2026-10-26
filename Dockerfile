# ---------------------------------------------------------------------------
# Production image: builds the app once (fast optimized output), then serves
# it. Far faster than `next dev` for the demo — pages are precompiled, not
# recompiled per request.
#
# Networking: joins the Zetaris Docker network (reach the REST API as
# http://api:8888) and reaches Meterless Nightshift on the Windows host via
# host.docker.internal.
# ---------------------------------------------------------------------------
FROM node:20-alpine

WORKDIR /app

# Install deps first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy source and build the optimized production bundle.
COPY . .
RUN npm run build

EXPOSE 3001

# Serve the precompiled production build (fast).
CMD ["npm", "run", "start"]
