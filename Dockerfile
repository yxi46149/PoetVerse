# syntax=docker/dockerfile:1
#
# PoetVerse 单镜像：Nginx 托管前端静态资源 + 反向代理 /api 到容器内 NestJS 进程。
# 数据库不打包进镜像，通过 DATABASE_URL 连接外部 MySQL。
#
#   docker build -t poetverse:latest .
#   docker run -d -p 8080:80 -e DATABASE_URL="mysql://user:pass@host:3306/poetverse" poetverse:latest

# ---------------------------------------------------------------- 构建阶段
FROM node:22-bookworm-slim AS build
WORKDIR /app

# 先只拷 lock 文件，依赖不变时这一层可以命中缓存
COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --no-audit --no-fund \
 && npm ci --no-audit --no-fund --prefix server

# 再拷源码；.dockerignore 已排除 node_modules / dist / data / .env
COPY . .

# 前端打静态包（默认 /api 同域请求），后端 nest build 前会自动 prisma generate
ARG VITE_API_BASE_URL=""
RUN VITE_API_BASE_URL="$VITE_API_BASE_URL" npm run build \
 && npm run build:api

# ---------------------------------------------------------------- 运行阶段
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8091

RUN apt-get update \
 && apt-get install -y --no-install-recommends nginx curl tini \
 && rm -rf /var/lib/apt/lists/* /var/www/html/* \
 && rm -f /etc/nginx/sites-enabled/default \
 # 以 root 起 nginx master，worker 降权为 www-data；这三个目录必须可写
 && mkdir -p /var/cache/nginx /var/log/nginx /run \
 && chown -R www-data:www-data /var/cache/nginx /var/log/nginx

WORKDIR /app/server

# 只保留生产依赖：@prisma/client 运行时必需（生成的客户端 import 了它的 runtime）。
# --omit=optional 会去掉 prisma CLI 和 @prisma/engines（约 324MB -> 104MB），
# 因为这里用 driver adapter 直连 MySQL，不需要查询引擎；已实测该依赖集可以正常启动服务。
COPY --from=build /app/server/package.json /app/server/package-lock.json ./
RUN npm ci --omit=dev --omit=optional --no-audit --no-fund \
 && npm cache clean --force

COPY --from=build /app/server/dist ./dist
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80

# 只探活静态站点，不依赖数据库；数据库是否可用看 /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1/healthz || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/usr/local/bin/docker-entrypoint.sh"]
