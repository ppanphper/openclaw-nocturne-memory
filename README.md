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

```bash
# 在 OpenClaw 扩展目录下
pnpm add @openclaw/nocturne-memory
```

## 配置

在 `agents.json5`（或 `openclaw.json5`）中添加插件配置：

```json5
{
  plugins: {
    "nocturne-memory": {
      // Nocturne Memory SSE 服务器地址
      url: "http://localhost:8000",

      // 每个 Agent 的命名空间映射
      agents: [
        { agentId: "main", namespace: "main" },
        { agentId: "research", namespace: "research" },
        { agentId: "creative", namespace: "creative" }
      ],

      // 可选：未映射 Agent 使用的默认命名空间（默认为空字符串）
      defaultNamespace: ""
    }
  },

  agents: {
    list: [
      {
        id: "main",
        tools: {
          allow: [
            "nocturne-memory",  // 启用该插件的所有工具
            // 或逐个指定:
            // "read_memory",
            // "create_memory",
            // "update_memory",
            // "delete_memory",
            // "add_alias",
            // "manage_triggers",
            // "search_memory"
          ]
        }
      }
    ]
  }
}
```

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

## 开发

```bash
git clone https://github.com/ppanphper/openclaw-nocturne-memory.git
cd openclaw-nocturne-memory
pnpm install
pnpm build
```

## License

MIT
