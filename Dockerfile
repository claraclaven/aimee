# ---------------------------------------------------------------------------
# Containerize the app so it can join the Zetaris Docker network and reach the
# REST API as http://api:8888 (inside the network the TLS overlay trusts).
# Meterless Nightshift (a Windows host app) is reached via host.docker.internal.
# ---------------------------------------------------------------------------
FROM node:20-alpine

WORKDIR /app

# Install deps first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy the rest of the source.
COPY . .

# Next.js dev server port.
EXPOSE 3001

# Dev mode keeps the demo simple (hot reload, no build step needed).
CMD ["npm", "run", "dev"]
