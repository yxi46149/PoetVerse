# PoetVerse

诗境 PoetVerse 是一个以古典诗词为主题的网站。前端使用 Vue 3、Vite、TypeScript、Vue Router、Element Plus 和 Tailwind CSS，后端位于 `server/`，使用 NestJS 11、Prisma 7 和 MySQL 8。

## 本地开发

安装前后端依赖并生成数据库客户端：

```powershell
npm install
npm --prefix server install
npm run db:generate
# Only copy the template when server/.env does not already exist.
if (!(Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
```

在 `server/.env` 配置数据库连接和本机 API 监听地址：

```dotenv
# MySQL 服务器地址和数据库端口只填在 DATABASE_URL 中。
DATABASE_URL=mysql://USER:PASSWORD@MYSQL_HOST:3306/poetverse
# 以下是本机 NestJS API 的监听地址和端口。
HOST=127.0.0.1
PORT=8080
```

`HOST`、`PORT` 对应本机 API 的 `127.0.0.1:8080`，不是 MySQL 地址和端口。需要局域网访问 API 时，可将 `HOST` 改为 `0.0.0.0`；MySQL 服务器地址和 `3306` 端口只写在 `DATABASE_URL` 中。

密码中的特殊字符需 URL 编码。数据库启用受信任 TLS 时可追加 `?ssl=true`；本地 MySQL 8 若需要获取认证公钥，可显式追加 `?allowPublicKeyRetrieval=true`。

启动后端和前端，各使用一个终端：

```bash
npm run dev:api
```

```bash
npm run dev -- --host 0.0.0.0 --port 3300
```

前端地址为 `http://localhost:3300`，API 地址为 `http://localhost:8080/api`。前端默认通过 `/api` 请求数据，由 Vite 代理至后端；需要自定义时设置 `VITE_API_BASE_URL`。

数据库已有数据时无需再次初始化。后端读取现有表，不在启动时执行迁移、重建表或重新导入；`db:generate` 只生成 Prisma 客户端。空库初始化和导入步骤见 [数据库说明](db/README.md)。

## 构建与预览

```bash
npm run build
npm run build:api
npm run preview
```

部署时可在 `server/` 执行 `npm start` 启动已构建的 API。`npm run preview` 只预览前端，生产环境需将 `/api` 转发至后端。

## Docker 部署

单个镜像里包含 Nginx（托管前端静态资源并把 `/api` 反代到 API）和 NestJS API，数据库不进镜像，通过 `DATABASE_URL` 连接外部 MySQL。

容器 80 只发布到宿主机回环地址，对外由宿主机上已有的 Nginx 反代（示例见 [deploy/host-nginx.sample.conf](deploy/host-nginx.sample.conf)），这样不占用宿主机 80 端口。

```bash
# 1. 建一次共享网络（MySQL 给多个应用共用，网络不归任何 compose 项目，谁 down 都不会删它）
docker network create shared-db

#    MySQL 那份 compose 也接进来（参考 deploy/mysql-compose.sample.yml）：
#      networks:
#        default:
#          name: shared-db
#          external: true

# 2. 用 server/.env 里的 DATABASE_URL 构建并启动（compose 自动读取，无需 --env-file）
docker compose up -d --build

# 3. 验证
curl http://127.0.0.1:8080/api/health
```

或手动构建运行：

```bash
docker build -t poetverse:latest .
docker run -d --name poetverse -p 127.0.0.1:8080:80 --network shared-db \
  -e DATABASE_URL="mysql://user:pass@mysql:3306/poetverse" \
  poetverse:latest
```

`GET /api/health` 会真的查一次库，返回 200 才说明数据库通了。

- 容器内 API 监听 `0.0.0.0:8091`，只对容器内的 Nginx 可见；对外只有容器的 80，且只绑宿主机回环。改映射端口用 `APP_PORT=8080`。
- **数据库以容器运行时，不要写宿主机地址**：MySQL 若只发布到 `127.0.0.1:3306`，那个端口其它容器连不到，`host.docker.internal` 也到不了（docker0 网关不是回环）。正确做法是共享 docker 网络、用容器名当主机名：`DATABASE_URL=mysql://user:pass@mysql:3306/poetverse`。
- 宿主机 80 已被占用时保持默认 bridge 网络 + `ports` 映射即可，**不要**改 host 网络模式（它会独占宿主机端口）。
- `.env` 不会被打进镜像（见 [.dockerignore](.dockerignore)）：镜像里只有依赖和构建产物，运行时配置由 compose 的 `env_file: server/.env` 注入（手动 `docker run` 时用 `-e`）。
- 前后端同域时 `VITE_API_BASE_URL` 留空即可；分域名部署时用 `--build-arg VITE_API_BASE_URL=https://api.example.com/api` 重新构建。
- 日志走 stdout：`docker logs -f poetverse`。想把 MySQL 也放进容器，取消 [docker-compose.yml](docker-compose.yml) 底部 `db` 服务的注释。

主页面位于 `/`，应用工作区位于 `/app`。当前接入公开诗词查询、筛选、详情和数据概览；后台登录、内容写入、收藏和阅读记录仍待实现。接口说明见 [后端实现建议](docx/后端实现建议.md)。
