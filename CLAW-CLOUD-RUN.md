# OpenMAIC 从 Docker 到 Claw Cloud Run 部署指南

本指南将带你从代码构建一个生产就绪的 Docker 镜像，通过 Docker Hub 推送，并最终部署到 Claw Cloud Run。

## 1. 准备你的数据库与环境变量

请确保你已经准备好了以下信息：
- 一个可通过公网访问的 MySQL 数据库连接串 (例如：`mysql://user:password@hostname:3306/db_name`)
- 至少一个 LLM API 密钥 (例如：`OPENAI_API_KEY=sk-...`)
- 如果启用了 OAuth 登录，请准备好 `AUTH_SECRET` 及对应的 `AUTH_OIDC_*` 相关变量。

## 2. 构建与推送到 Docker Hub

首先需要将项目构建成 Docker 镜像，然后将其推送到你的 Docker Hub 个人仓库下：

```bash
# 1. 登录到 Docker Hub
docker login

# 2. 这里的 <你的用户名> 请替换为你自己在 Docker Hub 的用户名
export DOCKER_USER="<你的用户名>"

# 3. 使用 Dockerfile 构建镜像并打上标签
docker build -t $DOCKER_USER/openmaic:latest .

# 4. 将刚才构建的镜像推送到 Docker Hub
docker push $DOCKER_USER/openmaic:latest
```

## 3. 在 Claw Cloud Run 中部署

进入 Claw Cloud Run 控制台，按照以下步骤创建服务：

1. **选择镜像来源**:
   - 选择 **“Docker Hub”** 作为镜像仓库来源。
   - 镜像名称填写：`你的用户名/openmaic:latest` （如 `janedoe/openmaic:latest`）。

2. **配置服务端口**:
   - 容器端口(Container Port): `3000`

3. **设置环境变量 (Environment Variables)**:
   在部署配置的“环境变量”部分输入你必须要配的参数。请必须包含：
   - `DATABASE_URL`: `mysql://...` (你的数据库连接字符串)
   - `OPENAI_API_KEY` (或你要用的其他大模型 API 参数)
   - `AUTH_SECRET`: (可使用 `openssl rand -base64 32` 在本地生成一串并填入，用于 NextAuth)

4. **健康检查 (Health Check)**:
   可选配置。如果需要，配置路径为 `/api/health` 或首页 `/`，端口保持 3000。

5. **执行部署**:
   点击部署/创建按钮！几分钟内就会完成镜像拉取和实例启动。

### 3.1 表单字段怎么填

如果你看到的是类似下面这些字段，可以直接按这个填写：

| 字段 | 建议填写 | 说明 |
| --- | --- | --- |
| TCP ports | `3000` | OpenMAIC 容器内部监听端口是 3000。若平台把对外 80 端口单独做映射，也可以保留平台默认分配。 |
| UDP ports | 留空 | 本项目不需要 UDP。 |
| 80 Optional | 可留空，或按平台默认 | 这是平台侧的可选对外端口映射项。如果你只是想让网页能访问，通常内部 3000 已够用。 |
| Command | 留空 | 直接使用 Dockerfile 默认启动命令。当前镜像会先自动执行数据库初始化，再启动服务。 |
| Arguments | 留空 | 不需要额外参数。 |
| Environment Variables | 必填 | 至少要配 `DATABASE_URL`、`AUTH_SECRET`、`AUTH_URL`、`AUTH_TRUST_HOST=true`，以及你要用的 LLM / OAuth 变量。 |
| Configmaps | 留空，或挂载 `server-providers.yml` | 如果你使用 YAML 方式管理模型配置，可以把 `server-providers.yml` 做成 ConfigMap 并挂载到 `/app/server-providers.yml`。否则可以不填。 |
| Local Storage | 推荐挂载 `/app/data` | 课堂、生成任务等文件会写到 `data/` 下。挂载本地存储可以避免重启后丢失课堂记录和任务状态。 |

#### 推荐的环境变量最小集合

```env
DATABASE_URL=mysql://openmaic:openmaic@<mysql-host>:3306/openmaic
AUTH_SECRET=<随机 32 字节以上>
AUTH_URL=https://<你的 Claw 访问域名>
AUTH_TRUST_HOST=true
OPENAI_API_KEY=sk-...
```

如果你还配置了自定义 OAuth，再补上：

```env
AUTH_ENABLED_PROVIDERS=oidc
AUTH_OIDC_ID=oidc
AUTH_OIDC_NAME=Company SSO
AUTH_OIDC_ISSUER=
AUTH_OIDC_CLIENT_ID=
AUTH_OIDC_CLIENT_SECRET=
AUTH_OIDC_AUTHORIZATION_URL=
AUTH_OIDC_TOKEN_URL=
AUTH_OIDC_USERINFO_URL=
AUTH_OIDC_SCOPE=openid profile email
```

> **注意：关于数据库初始化**
>
> 当前镜像在容器启动时会自动执行数据库初始化（默认 `prisma migrate deploy`，并带重试），无需手动执行迁移命令。
>
> 如需切换行为，可通过环境变量控制：
> ```env
> AUTO_DB_INIT=true
> PRISMA_INIT_MODE=migrate   # 可选: migrate | push | none
> DB_INIT_MAX_RETRIES=30
> DB_INIT_RETRY_DELAY_SECONDS=2
> ```
