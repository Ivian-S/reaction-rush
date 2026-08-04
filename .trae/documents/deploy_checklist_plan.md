# 部署前代码检查与修复计划

## 背景
用户计划将项目部署到 Railway（后端 + MySQL）和 Vercel（前端静态托管），需要对现有代码进行三项关键修改以确保线上环境正常运行。

---

## 修改 1：Express 监听 Railway 端口 + 绑定 0.0.0.0

### 当前状态
- `server/src/index.ts` 第 40 行：`app.listen(config.port, () => {...})` — 未绑定 `0.0.0.0`
- `server/src/config/env.ts` 第 71 行：`port: parseInt(process.env.PORT || '3001', 10)` — 逻辑正确但需配合监听使用

### 修改内容
**文件**: `server/src/index.ts`
- 将 `app.listen(config.port, callback)` 改为 `app.listen(config.port, '0.0.0.0', callback)`
- 确保 Railway 注入的 `PORT` 环境变量被正确读取并绑定到所有网络接口

**文件**: `server/src/config/env.ts`
- `port` 字段保持不变（已兼容 Railway 的 `PORT` 变量）

### 风险
- 无风险，本地开发时 `0.0.0.0` 不影响 `localhost` 访问

---

## 修改 2：前端 API 地址区分开发/生产环境

### 当前状态
- `frontend/src/composables/useApi.ts` 第 4 行：`const API_BASE = import.meta.env.VITE_API_BASE || '/api'`
- 拼接方式为 `${API_BASE}/health`，未处理尾部斜杠
- 环境变量名为 `VITE_API_BASE`

### 修改内容
**文件**: `frontend/src/composables/useApi.ts`
- 将变量名改为 `VITE_API_BASE_URL`
- 新增 `createApiUrl(path)` 辅助函数，统一处理尾部斜杠
- 所有 `fetch` 调用改用 `createApiUrl()` 生成 URL

```typescript
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'
export const API_BASE_URL = rawBaseUrl.replace(/\/$/, '')

export function createApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}
```

**文件**: `frontend/src/vite-env.d.ts`
- 类型声明更新：`VITE_API_BASE` → `VITE_API_BASE_URL`

**文件**: `frontend/.env.production`
- 变量名更新为 `VITE_API_BASE_URL`

**文件**: `frontend/.env.development`
- 变量名更新为 `VITE_API_BASE_URL`

### 使用示例
- 本地开发（不设置变量）：`createApiUrl('/health')` → `/api/health` → Vite 代理
- Vercel 生产（设置 `VITE_API_BASE_URL=https://xxx.up.railway.app/api`）：`createApiUrl('/health')` → `https://xxx.up.railway.app/api/health`

### 风险
- 需确保 Vite 代理配置在开发环境仍正确工作（不影响）
- 需确保 Vercel 环境变量名与代码一致

---

## 修改 3：CORS 精确来源控制

### 当前状态
- `server/src/index.ts` 第 12-15 行：`app.use(cors({ origin: config.corsOrigins, credentials: true }))` — 直接传递字符串/数组
- `server/src/config/env.ts` 支持 `*` 通配和逗号分隔
- 缺少自定义 origin 回调，curl/Postman 等无 Origin 请求可能被拒

### 修改内容
**文件**: `server/src/index.ts`
- 替换 cors 中间件为自定义 origin 回调：

```typescript
const allowedOrigins = new Set(
  config.corsOrigins
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
)

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true)
      return
    }
    callback(new Error(`Origin not allowed: ${origin}`))
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}))
```

**文件**: `server/src/config/env.ts`
- 移除 `*` 通配支持（改为精确来源列表）
- `corsOrigins` 改为字符串类型，由 Railway 设置具体域名列表

### Railway 环境变量
```
CORS_ORIGINS=http://localhost:5173,https://你的项目.vercel.app
```

### 风险
- 若 Vercel 域名未正确添加到 CORS_ORIGINS，浏览器会拒绝跨域请求
- 部署时需确保 Railway 中 `CORS_ORIGINS` 包含 Vercel 完整域名（不带路径）

---

## 涉及文件汇总

| 文件 | 操作 | 改动量 |
|------|------|--------|
| `server/src/index.ts` | 修改 | 中等（监听端口 + CORS 中间件） |
| `server/src/config/env.ts` | 修改 | 小（移除通配逻辑） |
| `frontend/src/composables/useApi.ts` | 修改 | 中等（API URL 重构） |
| `frontend/src/vite-env.d.ts` | 修改 | 小（变量名更新） |
| `frontend/.env.production` | 修改 | 小（变量名更新） |
| `frontend/.env.development` | 修改 | 小（变量名更新） |

## 不变的文件
- `server/.env.example` — 保持不变（含通配示例即可，实际由 Railway 覆盖）
- `railway.toml` — 保持不变
- `frontend/vercel.json` — 保持不变
- 其他所有业务逻辑文件不变