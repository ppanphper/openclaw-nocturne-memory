# @openclaw/nocturne-memory

OpenClaw 插件 — 基于 [Nocturne Memory](https://github.com/Dataojitori/nocturne_memory) 的多 Agent 长期记忆系统，通过命名空间实现 Agent 间记忆隔离。

## 特性

- **单实例多 Agent**：所有 Agent 共用一个 Nocturne Memory 进程，通过命名空间逻辑隔离
- **Agent 透明化**：Agent 不知道命名空间的存在，无法越狱访问其他 Agent 的记忆
- **完整功能保留**：7 个 MCP 工具全部代理，domain 过滤精度不受影响
- **升级安全**：对 NM 的核心改动极小且机械化，不影响上游升级合并

## 前置要求

1. 安装支持命名空间的 Nocturne Memory fork:

```bash
git clone -b feature/namespace https://github.com/ppanphper/nocturne_memory.git
cd nocturne_memory
pip install -r requirements.txt
```

2. 启动 NM SSE 服务器:

```bash
cd nocturne_memory
python backend/run_sse.py
# 默认监听 http://localhost:8000
```

## 安装

**本地安装（推荐开发测试）：**

```bash
openclaw plugins install -l /path/to/openclaw-nocturne-memory
```

**npm 安装：**

```bash
openclaw plugins install @openclaw/nocturne-memory
```

## 配置

安装后在 OpenClaw 配置文件中添加以下内容。注意：插件自身的配置项（`url`、`agents`、`defaultNamespace`）必须放在 `config` 对象内。

```json5
{
  "plugins": {
    "allow": ["nocturne-memory"],
    // 本地安装时需要 load.paths（-l 安装会自动添加）
    "load": {
      "paths": ["/path/to/openclaw-nocturne-memory"]
    },
    "entries": {
      "nocturne-memory": {
        "enabled": true,
        "config": {
          // Nocturne Memory 服务器地址
          // Docker Compose 部署（Nginx 反代）: http://localhost:80
          // 本地裸机部署: http://localhost:8001
          "url": "http://localhost:80",

          // 每个 Agent 的命名空间映射
          "agents": [
            { "agentId": "main", "namespace": "main" },
            { "agentId": "research", "namespace": "research" },
            { "agentId": "creative", "namespace": "creative" }
          ],

          // 可选：未映射 Agent 使用的默认命名空间（默认为空字符串）
          "defaultNamespace": ""
        }
      }
    }
  }
}
```

> **常见错误**：如果把 `url`、`agents` 直接放在 `nocturne-memory` 下（与 `enabled` 同级），
> 会导致 config 校验失败或插件读不到配置。必须嵌套在 `config` 内。

## 工作原理

```
┌─────────────┐      ┌──────────────────────────────┐      ┌──────────────────┐
│  Agent A     │─────▶│  OpenClaw 插件                 │─────▶│  Nocturne Memory │
│  (main)      │      │  namespace="main"             │      │  SSE Server      │
├─────────────┤      │                              │      │                  │
│  Agent B     │─────▶│  namespace="research"         │─────▶│  /mcp?namespace= │
│  (research)  │      │                              │      │                  │
└─────────────┘      └──────────────────────────────┘      └──────────────────┘
```

1. 插件启动时连接到 NM 的 Streamable HTTP 端点 (`/mcp`)
2. 当 Agent 调用任何记忆工具时，插件根据 `agentId → namespace` 映射，在请求 URL 中携带 `?namespace=xxx`
3. NM 的 `NamespaceMiddleware` 提取命名空间并通过 `contextvars` 注入到整个请求链
4. 所有数据库查询自动按命名空间过滤，实现完全隔离

## 提供的工具

| 工具 | 说明 |
|------|------|
| `read_memory` | 读取记忆（支持 `system://boot`, `system://index` 等特殊 URI） |
| `create_memory` | 在父 URI 下创建新记忆 |
| `update_memory` | 更新已有记忆内容（替换/追加模式） |
| `delete_memory` | 删除记忆路径 |
| `add_alias` | 创建别名路径指向同一记忆 |
| `manage_triggers` | 管理记忆的触发关键词 |
| `search_memory` | 全文搜索记忆（支持 domain 过滤） |

## 记忆系统提示词

本项目提供了一份开箱即用的 **Agent System Prompt**，指导 AI 自主管理长期记忆（何时读取、何时写入、何时整理）。

👉 **[查看完整提示词](docs/MEMORY_SYSTEM_PROMPT.md)**

将该提示词复制到你的 OpenClaw Agent 的 System Prompt 中即可使用。无需 mcporter，所有记忆工具已作为 OpenClaw 原生工具注册。

## 开发

```bash
git clone https://github.com/ppanphper/openclaw-nocturne-memory.git
cd openclaw-nocturne-memory
pnpm install
pnpm build
```

## License

MIT
