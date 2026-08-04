# Reaction Rush · 极限反应挑战



## 功能列表

- 🎯 **核心游戏**：5 轮反应测试，2000-5000ms 随机等待，3 秒超时保护
- ⏱️ **精确计时**：使用 `performance.now()` 与 `requestAnimationFrame` 测量毫秒级反应时间
- 🏆 **双重排行榜**：平均反应榜 TOP 10 与最快单轮榜 TOP 10
- 📊 **成绩图表**：原生 SVG 折线图展示各轮反应时间，有效/失误一目了然
- 🎖️ **评级系统**：根据平均反应时间给出 6 档中文评级
- 💾 **成绩保存**：支持新纪录标记、重复提交幂等、昵称二次确认
- 🔁 **失败重试**：网络或数据库异常时可一键重试保存
- 📋 **分享文案**：一键复制成绩分享到社交平台
- ⚙️ **高级设置**：4 种主题切换 + 自定义主题 + 音效 + 震动开关
- 📱 **响应式**：适配 320px 手机到 1920px 桌面
- 📴 **降级体验**：数据库不可用时仍可正常游玩与查看结果

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | Vue 3、Vue Router、TypeScript、Vite、Element Plus、Composition API、Scoped CSS、CSS Variables |
| 后端 | Node.js、Express、TypeScript、mysql2/promise |
| 数据库 | MySQL 8.0（InnoDB、utf8mb4） |
| 工具链 | pnpm Workspace |

## 项目目录

```
reaction-rush/
├─ frontend/                  # 前端应用
│  ├─ src/
│  │  ├─ components/          # NicknameDialog、SettingsDialog
│  │  ├─ composables/         # useApi、useGameSession、useSettings
│  │  ├─ router/              # Vue Router 路由守卫
│  │  ├─ styles/main.css      # 全局样式与 CSS 变量
│  │  ├─ types/               # game、rating、settings 类型
│  │  ├─ views/               # Home、Game、Result
│  │  ├─ App.vue、main.ts
│  │  └─ vite-env.d.ts
│  ├─ index.html
│  ├─ vite.config.ts          # Vite 代理 /api -> :3001
│  └─ package.json
├─ server/                    # 后端服务
│  ├─ src/
│  │  ├─ config/env.ts        # 环境变量解析
│  │  ├─ db/                  # pool 连接池、init 初始化
│  │  ├─ routes/              # health、players、sessions、leaderboard
│  │  ├─ services/            # sessionService、playerService、leaderboardService
│  │  ├─ types/index.ts       # API 响应类型与工具
│  │  ├─ utils/nickname.ts    # 昵称校验
│  │  └─ index.ts             # Express 入口
│  ├─ .env.example            # 环境变量模板
│  └─ package.json
├─ pnpm-workspace.yaml
├─ package.json               # 根聚合脚本
└─ README.md
```

## 环境要求

| 软件 | 版本要求 |
| --- | --- |
| Node.js | >= 18 |
| pnpm | 最新稳定版（推荐 9+） |
| MySQL | 8.0.32 |
| 现代浏览器 | Chrome / Edge / Firefox / Safari（支持 Pointer Events、Web Audio、Vibration API） |

## MySQL 8.0.32 配置

1. 启动 MySQL 服务（Windows 下可在「服务」面板启动 MySQL80）。
2. 使用 MySQL 客户端（Navicat、MySQL Workbench 或命令行）创建用于本项目的账号，或直接使用 `root`。
3. 确认字符集为 `utf8mb4`、引擎为 `InnoDB`。

数据库 **无需手工创建**：后端首次启动会自动执行 `CREATE DATABASE IF NOT EXISTS reaction_rush` 及建表语句。

## 数据库名称

固定为 `reaction_rush`（见 `server/.env.example` 的 `DB_NAME`）。

## 环境变量说明

复制 `server/.env.example` 为 `server/.env`，并按实际环境修改：

| 变量 | 示例 | 说明 |
| --- | --- | --- |
| `PORT` | `3001` | 后端 HTTP 端口 |
| `CORS_ORIGINS` | `http://localhost:5173` | 允许跨域的前端地址，多个用逗号分隔 |
| `DB_HOST` | `localhost` | MySQL 主机 |
| `DB_PORT` | `3306` | MySQL 端口 |
| `DB_USER` | `root` | MySQL 用户名 |
| `DB_PASSWORD` | `your_mysql_password` | MySQL 密码 |
| `DB_NAME` | `reaction_rush` | 数据库名称 |

`server/.env` 已在 `.gitignore` 中，不会被提交。

## 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

该命令会通过 `pnpm-workspace.yaml` 同时安装 `frontend` 与 `server` 两个 workspace 包的依赖。

## 分别启动前端和后端

**后端（先启动，因为前端需要通过 Vite 代理访问后端 API）：**

```bash
pnpm dev:server
```

等价于 `cd server && pnpm dev`，使用 `tsx watch` 热启动 Express，默认监听 `http://localhost:3001`。

**前端：**

```bash
pnpm dev:frontend
```

等价于 `cd frontend && pnpm dev`，Vite 默认监听 `http://localhost:5173`，并将 `/api` 代理到后端 `http://localhost:3001`。

**开发联调：** 浏览器访问 `http://localhost:5173` 即可。

## API 列表

基础路径：`/api`。所有响应格式：

```json
{ "success": true, "code": "OK", "message": "...", "data": { } }
```

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查，附带数据库连接状态 |
| GET | `/api/players/exists?nickname=xxx` | 检查昵称是否已存在 |
| POST | `/api/sessions` | 提交一次完整测试（5 轮）并保存成绩 |
| GET | `/api/leaderboard/average?limit=10` | 平均反应时间排行榜 TOP N |
| GET | `/api/leaderboard/fastest?limit=10` | 最快单轮排行榜 TOP N |
| DELETE | `/api/leaderboard/clear` | 清空所有玩家和排行榜数据（高级设置） |

### `POST /api/sessions` 请求体

```json
{
  "sessionId": "uuid",
  "nickname": "玩家昵称",
  "confirmedExistingNickname": false,
  "rounds": [
    { "roundNumber": 1, "resultType": "success", "reactionMs": 245, "waitDurationMs": 2345, "occurredAt": "2026-08-04T..." }
  ]
}
```

`resultType` 取值：`success` / `early` / `timeout` / `abnormal`。

### 常见 `code` 值

- `OK`：保存成功
- `DUPLICATE_SESSION`：`sessionId` 已提交过，返回已有结果
- `NOT_QUALIFIED`：有效成绩不足 3 轮，未进入排行榜
- `NO_PERSONAL_BEST`：成绩有效但未刷新玩家个人最好成绩
- `NICKNAME_CONFIRM_REQUIRED`：昵称已存在，需要前端让用户二次确认
- `INVALID_NICKNAME`：昵称格式不合法
- `DATABASE_UNAVAILABLE` / `INTERNAL_ERROR`：数据库或服务器内部异常

## 数据库表说明

### `players`
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | BIGINT UNSIGNED PK | 玩家 ID |
| nickname | VARCHAR(12) | 展示昵称 |
| nickname_key | VARCHAR(12) UNIQUE | 规范化（小写）键，用于查重 |
| best_avg_session_id | BIGINT UNSIGNED NULL | 指向玩家平均最佳成绩会话 |
| fastest_session_id | BIGINT UNSIGNED NULL | 指向玩家最快单轮成绩会话 |
| created_at / updated_at | DATETIME(3) | 时间戳 |

### `test_sessions`
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | BIGINT UNSIGNED PK | 会话 ID |
| client_session_id | VARCHAR(64) UNIQUE | 前端生成的 `sessionId`，防止重复提交 |
| player_id | BIGINT UNSIGNED FK -> players.id | 玩家外键 |
| avg_reaction_ms | INT UNSIGNED NULL | 有效成绩平均值（整数 ms） |
| fastest_reaction_ms | INT UNSIGNED NULL | 最快单轮（整数 ms） |
| slowest_reaction_ms | INT UNSIGNED NULL | 最慢有效轮 |
| valid_count / early_count / timeout_count / abnormal_count | TINYINT UNSIGNED | 5 轮结果分布 |
| completed_at | DATETIME(3) | 完成时间 |
| is_best_avg / is_fastest | TINYINT(1) | 是否为玩家新纪录 |
| created_at / updated_at | DATETIME(3) | 时间戳 |

### `test_rounds`
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | BIGINT UNSIGNED PK | 轮次 ID |
| session_id | BIGINT UNSIGNED FK -> test_sessions.id | 所属会话 |
| round_number | TINYINT UNSIGNED | 1-5 |
| result | ENUM('success','early','timeout','abnormal') | 轮次结果 |
| reaction_ms | INT UNSIGNED NULL | 反应时间 ms（仅 success 有值） |
| wait_duration_ms | INT UNSIGNED | 该轮随机等待时间 |
| occurred_at | DATETIME(3) | 发生时间 |

## 排行榜规则

1. 仅统计 **有效成绩 >= 3 轮** 的会话；
2. **平均反应榜**：按 `avg_reaction_ms` 升序（越快越好），相同则按最快单轮、完成时间排序；
3. **最快单轮榜**：按 `fastest_reaction_ms` 升序排序；
4. 每个玩家在每个排行榜中 **仅出现一次**（取玩家最佳成绩）；
5. 最多返回 TOP 10（可通过 `limit` 参数调整，上限 50）。

## 昵称重复规则

- 昵称长度 **1-12 个字符**，仅支持 **中文、英文、数字**；
- 后端将昵称规范化为小写 `nickname_key`（`FOO` 与 `foo` 视为同一玩家）；
- 首次输入已存在昵称时，后端返回 `NICKNAME_CONFIRM_REQUIRED`，前端弹窗让用户确认继续使用；
- 确认后新成绩仍会写入数据库，可能刷新原玩家的个人纪录；
- `players.nickname_key` 建有唯一索引，不允许重复。

## 常见问题

**Q：游戏中点击屏幕没反应？**
A：请确认当前焦点不在输入框上，且没有打开弹窗。空格键和鼠标/触摸点击均支持。

**Q：为什么显示「成绩有效，但未刷新个人纪录」？**
A：你的平均反应时间和最快单轮均未超过该昵称历史最佳成绩，因此未更新 `players` 表的最佳引用。成绩仍会保留在 `test_sessions` 中。

**Q：为什么显示「有效轮次不足 3 轮」？**
A：5 轮中必须至少 3 轮为 `success`（反应时间 50-3000ms）才能进入排行榜。过早、超时和 <50ms 异常轮不计入有效。

**Q：如何修改主题？**
A：首页右上角 ⚙️ 按钮打开高级设置，可选 4 种预设主题或自定义 7 种颜色。

**Q：Vite 启动后访问 `/api` 提示 404？**
A：说明后端未启动或端口不对。请先 `pnpm dev:server` 启动后端（默认 3001 端口）。

**Q：可以用 TypeScript 写的后端直接运行生产模式吗？**
A：可以。使用 `pnpm build:server` 编译生成 `dist/index.js`，再用 `node dist/index.js` 启动；开发期推荐 `tsx watch`。

## 数据库连接失败处理

**现象**：访问 API 返回 `DATABASE_UNAVAILABLE` 或首页排行榜显示「排行榜暂时不可用」。

**排查步骤**：

1. 确认 MySQL 服务已启动（Windows 下打开 `services.msc`，查找 MySQL80 并启动）；
2. 在命令行测试账号密码：
   ```bash
   mysql -h localhost -P 3306 -u root -p
   ```
3. 检查 `server/.env` 中的 `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` 是否与实际一致；
4. 确认 3306 端口未被防火墙或安全软件拦截；
5. 若数据库暂不可用，前端仍可正常游玩并查看结果页，仅成绩保存会提示「网络或数据库不可用」，可在恢复后点击「重试保存」。

**降级行为**：后端数据库初始化失败不会阻止 Express 启动，日志中会打印 `[DB] Database initialization failed` 与 `[DB] Server will start without database support`。

## 构建命令

| 命令 | 说明 |
| --- | --- |
| `pnpm install` | 安装所有 workspace 依赖 |
| `pnpm dev:server` | 开发模式启动后端（tsx watch，端口 3001） |
| `pnpm dev:frontend` | 开发模式启动前端（Vite，端口 5173） |
| `pnpm typecheck` | 前后端 TypeScript 类型检查 |
| `pnpm build:frontend` | 构建前端到 `frontend/dist/`（包含 `vue-tsc --noEmit`） |
| `pnpm build:server` | 编译后端 TS 到 `server/dist/` |
| `pnpm preview` | 预览前端生产构建 |

完整构建流程：

```bash
pnpm typecheck
pnpm build:frontend
pnpm build:server
```

## 启动说明速查

```bash
# 1. 克隆项目后安装依赖
pnpm install

# 2. 配置后端环境变量（首次）
copy server\.env.example server\.env
# 编辑 server/.env 填入 MySQL 账号密码

# 3. 启动后端
pnpm dev:server
# => http://localhost:3001

# 4. 启动前端（另一个终端）
pnpm dev:frontend
# => http://localhost:5173

# 5. 打开浏览器访问 http://localhost:5173 开始游戏
```
