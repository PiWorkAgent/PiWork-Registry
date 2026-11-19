# PiWork-Registry

PiWork 的插件市场索引。**这里只放"去哪里找插件"，不放插件代码。**

客户端读取的入口只有这一个：

```
https://github.com/PiWorkAgent/PiWork-Registry/releases/latest/download/index.json
```

## 它是怎么来的

`sources.json` 列出每个插件源；工作流定时（每 6 小时）以及 `sources.json` 变更时，逐个拉取插件仓库自己发布的最新索引，合并后发布为本仓库的 release 资产：

```
sources.json
  → 每个源: https://github.com/<owner>/<repo>/releases/latest/download/index.json
  → 合并（官方在前）+ 校验 sha256/版本/绝对 URL
  → dist/index.json → Release 资产 → 上面那个 URL
```

好处是：**registry 不需要 GitHub API、不需要 token、不关心插件仓库结构**。每个插件仓库发布什么，registry 就聚合什么。

客户端按 `sha256` 校验每个 zip；下载地址是各插件 Release 里固定的绝对地址，索引合并后不会再变。

## 官方插件

| 插件 | 仓库 |
| --- | --- |
| `com.pi.browser` | [PiWork-Plugin-Browser](https://github.com/PiWorkAgent/PiWork-Plugin-Browser) |
| `com.pi.devdocs` | [PiWork-Plugin-Docs](https://github.com/PiWorkAgent/PiWork-Plugin-Docs) |
| `com.pi.diagnostics` | [PiWork-Plugin-Diagnostics](https://github.com/PiWorkAgent/PiWork-Plugin-Diagnostics) |
| `com.pi.files` | [PiWork-Plugin-Files](https://github.com/PiWorkAgent/PiWork-Plugin-Files) |
| `com.pi.tasks` | [PiWork-Plugin-Tasks](https://github.com/PiWorkAgent/PiWork-Plugin-Tasks) |

## 上架一个社区插件

插件必须**在自己的仓库里**发布，不需要官方仓库的写权限。要求：

1. 插件仓库根目录有 `manifest.json`（字段见 `PiWork/docs/plugin-dev-guide.md`）。
2. 仓库里有 `scripts/release.mjs`（从任意官方插件仓库复制）或等价实现：打包 zip + 生成单条目 `index.json`（带 `sha256` 和绝对 `url`）。
3. 推送 tag `v<manifest.version>` 后，Release 里同时有 `<id>-<version>.zip` 和 `index.json`。
4. 用 [插件上架申请](.github/PULL_REQUEST_TEMPLATE/plugin-submission.md) 提 PR，往 `sources.json` 加一条：

```json
{
  "id": "com.example.weather",
  "repo": "developer-a/weather-plugin",
  "official": false,
  "categories": ["工具"]
}
```

非 GitHub 托管也可以，用 `indexUrl` 给出索引地址：

```json
{ "id": "com.example.weather", "indexUrl": "https://example.com/registry/com.example.weather.json" }
```

维护者合并后，下一次刷新就会出现在市场里。插件作者以后自己发新版，**不需要再改 registry**。

## 信任模型（请如实理解）

- **`sha256` 只证明完整性**：下载包和索引里写的一致。它不证明发布者身份。
- **没有数字签名**。索引和包都通过 HTTPS 从发布方获取，信任锚是"索引里写的那个 URL"。
- **official 只是标记**，表示由本项目维护；社区插件 `official: false`。
- **上架不等于审核过代码**。Registry 的人工检查只覆盖元数据与发布流程；打包内容由插件作者负责。安装时的权限确认是用户唯一的实时防线。
- 插件后端拥有与用户账户相同的权限（完整 Node 进程），权限声明约束的是插件通过宿主获取能力的范围，不是操作系统沙箱。

## 已知边界

- 单个源失败会被跳过并在日志里打 warning，不会让整个 registry 失败；全部源都失败时构建报错。
- 索引有变化才发布新 release（避免每 6 小时一个空 release）。
- GitHub Actions 定时任务可能延迟或跳过；需要立即刷新时手动运行 **Refresh registry**。
