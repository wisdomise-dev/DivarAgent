# DivarAgent - Playwright + Node.js
FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (production only for smaller image, or omit --omit=dev for dev deps)
RUN npm ci

# Install Playwright browsers (chromium included in base image, but ensure deps)
RUN npx playwright install chromium

# Copy source
COPY tsconfig.json ./
COPY agent-core ./agent-core
COPY src ./src
COPY public ./public

# Use headless mode in Docker (no display)
ENV HEADLESS=true
ENV PORT=3344

EXPOSE 3344

# Run dashboard
CMD ["npx", "ts-node", "src/server.ts"]
