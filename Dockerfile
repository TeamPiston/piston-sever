FROM node:22-bookworm AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS production
RUN apt-get update && \
    apt-get install -y openscad cura-engine && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY src/slicer/profiles ./profiles
RUN mkdir -p ./output
ENV OPENSCAD_BIN=/usr/bin/openscad
ENV CURA_BIN=/usr/bin/CuraEngine
ENV CURA_DEFINITIONS_PATH=/usr/share/cura-engine/resources/definitions
ENV CURA_PROFILE_PATH=/app/profiles/qidi_max4.def.json
ENV OUTPUT_DIR=/app/output
ENV SCAD_GENERATOR=hardcoded
EXPOSE 3000
CMD ["node", "dist/main"]
