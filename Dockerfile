# syntax=docker/dockerfile:1
# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies against the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build. NEXT_PUBLIC_* values are inlined into the client bundle
# at build time, so NEXT_PUBLIC_APP_URL must be provided as a build arg.
COPY . .
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN npm run build

# Drop dev-only tooling (tailwind/postcss/eslint) from node_modules; `next start`
# + mongoose/nodemailer remain. Smaller runtime image, less attack surface.
RUN npm prune --omit=dev

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only what `next start` needs, owned by the built-in non-root user.
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/next.config.js ./

USER node
EXPOSE 3000
CMD ["npm", "start"]
