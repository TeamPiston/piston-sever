# syntax=docker/dockerfile:1

########################################
# 1) CuraEngine 빌드 스테이지
#    - CuraEngine 저장소는 slicer 엔진만 포함하고 있어
#      슬라이싱에 필요한 definitions(fdmprinter.def.json 등)는
#      Cura 본체 저장소에서 resources 디렉토리만 sparse-checkout 한다.
########################################
FROM debian:bookworm AS cura-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential cmake ninja-build git \
        python3 python3-pip python3-venv \
        pkg-config ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages --no-cache-dir "conan==2.7.0"

# CuraEngine 릴리즈 태그 확인: https://github.com/Ultimaker/CuraEngine/tags
ARG CURAENGINE_VERSION=5.7.0
WORKDIR /build/CuraEngine

RUN git clone --branch "${CURAENGINE_VERSION}" --depth 1 \
        https://github.com/Ultimaker/CuraEngine.git . \
    && conan profile detect --force \
    && conan install . --build=missing --update \
        -c tools.build:skip_test=True -s build_type=Release \
    && cmake --preset release \
    && cmake --build --preset release

# 빌드된 바이너리와 그 바이너리가 동적 링크하는 공유 라이브러리를
# 별도 디렉토리로 모아 런타임 스테이지에서 그대로 복사할 수 있게 한다.
RUN mkdir -p /cura-runtime/bin /cura-runtime/lib \
    && BIN=$(find /build/CuraEngine -maxdepth 5 -type f -name CuraEngine | head -n1) \
    && cp "$BIN" /cura-runtime/bin/CuraEngine \
    && ldd /cura-runtime/bin/CuraEngine \
        | awk '{print $3}' | grep '^/' \
        | xargs -I{} cp -L --parents {} /cura-runtime/lib/ 2>/dev/null || true

# CuraEngine 실행에 필요한 definitions/quality 리소스
RUN git clone --depth 1 --filter=blob:none --sparse \
        https://github.com/Ultimaker/Cura.git /cura-resources \
    && cd /cura-resources && git sparse-checkout set resources

########################################
# 2) NestJS 빌드 스테이지
########################################
FROM node:20-bookworm AS node-builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
RUN pnpm prune --prod

########################################
# 3) 런타임 스테이지
########################################
FROM node:20-bookworm-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
        openscad \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/package.json ./
COPY src/slicer/profiles ./profiles

COPY --from=cura-builder /cura-runtime/bin/CuraEngine /usr/bin/CuraEngine
COPY --from=cura-builder /cura-runtime/lib/ /
COPY --from=cura-builder /cura-resources/resources /usr/share/cura-engine/resources

RUN mkdir -p ./output \
    && groupadd -r app && useradd -r -g app app \
    && chown -R app:app /app

ENV OPENSCAD_BIN=/usr/bin/openscad
ENV CURA_BIN=/usr/bin/CuraEngine
ENV CURA_DEFINITIONS_PATH=/usr/share/cura-engine/resources/definitions
ENV CURA_PROFILE_PATH=/app/profiles/qidi_max4.def.json
ENV OUTPUT_DIR=/app/output
ENV SCAD_GENERATOR=hardcoded

# DB / Redis / JWT / SMTP / 외부 API 값은 .env(docker-compose env_file)로 주입한다.

USER app
EXPOSE 3000
CMD ["node", "dist/main"]
