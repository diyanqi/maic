# 第三方应用接入 OpenMAIC 新建课堂

这份文档说明第三方应用如何把一份 Markdown 讲义传给 OpenMAIC，并让 OpenMAIC 自动创建一门课堂给用户查看。

目前推荐有两种接入方式：

1. **前端跳转方式**: 第三方应用把用户浏览器重定向到 OpenMAIC 的连接页面，由 OpenMAIC 自动读取 Markdown、提交课堂生成任务，并在完成后跳转到课堂页。
2. **服务端直连方式**: 第三方应用自己调用 OpenMAIC 的 `POST /api/generate-classroom` 接口，拿到任务 ID 后再轮询任务状态。

---

## 方式一: 前端跳转到 OpenMAIC 连接页

这是最适合“用户在第三方应用里点一下，然后打开 OpenMAIC 开始生成课堂”的方式。

### 入口地址

```text
/connect/markdown
```

### 支持的参数

- `markdown`: 直接传入 Markdown 文本
- `md`: `markdown` 的别名
- `md64`: 将 Markdown 先做 Base64URL 编码后再传入，适合内容较长的场景
- `title`: 可选，讲义标题

### 推荐跳转示例

```text
https://你的-openmaic-域名/connect/markdown?title=线性代数导论&md64=QmFzZTY0VVJMX0V4YW1wbGU...
```

如果 Markdown 较短，也可以直接传文本：

```text
https://你的-openmaic-域名/connect/markdown?title=线性代数导论&markdown=%23%20线性代数%0A%0A##%20矩阵
```

### 跳转流程

1. 第三方应用拿到 Markdown 讲义。
2. 前端跳转到 `/connect/markdown`。
3. OpenMAIC 自动把 Markdown 组装成课堂生成请求。
4. OpenMAIC 调用现有的 `POST /api/generate-classroom`。
5. 生成完成后自动跳转到课堂页面 `/classroom/{classroomId}`。

### 适合场景

- Feishu / 飞书机器人点击卡片后打开网页
- Slack / Telegram / Discord 消息里的按钮跳转
- 任何可以打开浏览器的第三方前端应用

### 为什么推荐 `md64`

Markdown 直接放在 URL 里容易受长度限制影响，尤其是讲义比较长的时候。

建议：

- 短讲义可以直接用 `markdown`
- 长讲义优先用 `md64`

### `md64` 的编码建议

推荐编码成 **Base64URL**，避免 URL 中出现 `+`、`/`、`=` 这类需要额外处理的字符。

示意：

```ts
function toBase64Url(text: string) {
  return btoa(unescape(encodeURIComponent(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
```

---

## 方式二: 第三方应用服务端直接调用生成接口

如果你的第三方系统本身有后端，或者你想自己控制生成任务的提交和轮询，推荐直接调用 OpenMAIC 的生成接口。

### 提交任务

```text
POST /api/generate-classroom
```

### 请求体

```json
{
  "requirement": "请基于以下 Markdown 讲义生成一门课堂...",
  "enableTTS": true
}
```

### 讲义内容如何传

可以把 Markdown 拼进 `requirement` 里，例如：

```json
{
  "requirement": "请基于以下 Markdown 讲义生成课堂。\n\n---\n# 第一章\n...\n---"
}
```

### 返回值

提交成功后会返回类似：

```json
{
  "success": true,
  "data": {
    "jobId": "abc123",
    "pollUrl": "https://你的-openmaic-域名/api/generate-classroom/abc123",
    "pollIntervalMs": 5000
  }
}
```

### 轮询任务状态

```text
GET /api/generate-classroom/{jobId}
```

当状态变为 `succeeded` 时，返回结果里会带有：

- `result.classroomId`
- `result.url`

第三方应用可据此跳转到课堂页。

---

## 推荐的字段约定

如果你要设计第三方应用和 OpenMAIC 的对接协议，建议按下面的字段组织：

```ts
interface ThirdPartyClassroomPayload {
  title?: string;
  markdown: string;
  sourceUrl?: string;
  sourceApp?: string;
  language?: 'zh-CN' | 'en-US';
}
```

### 字段说明

- `title`:
  - 讲义标题
  - 可选，但建议提供，方便 OpenMAIC 在页面上展示更明确的内容
- `markdown`:
  - 讲义正文
  - 必填
- `sourceUrl`:
  - 原文链接或来源地址
  - 可选，便于追溯
- `sourceApp`:
  - 来源应用名，例如 `feishu`、`slack`、`telegram`
  - 可选
- `language`:
  - 讲义语言
  - 可选，当前未强制依赖

---

## 推荐接入方案

### 方案 A: 用户浏览器跳转

适合：

- 用户在第三方应用点击按钮
- 第三方应用没有自己的后端生成能力
- 你希望尽量少写集成代码

流程：

1. 第三方应用生成一个跳转链接
2. 用户打开链接
3. OpenMAIC 自动创建课堂
4. 完成后跳转到课堂

### 方案 B: 服务端直连

适合：

- 第三方应用有自己的后端
- 你要做更复杂的权限、审计、任务管理
- 你希望在后台控制生成进度

流程：

1. 第三方应用后端调用 `POST /api/generate-classroom`
2. 记录 `jobId` 和 `pollUrl`
3. 后台轮询直到 `succeeded`
4. 将课堂链接返回给用户

---

## 需要注意的点

1. **Markdown 太长时优先用 `md64` 或服务端直连**。
2. **如果第三方应用在浏览器里打开 OpenMAIC，建议直接走 `/connect/markdown`**。
3. **如果你想让第三方应用只负责传数据，不负责生成逻辑，推荐使用服务端直连方式**。
4. **OpenMAIC 生成课堂时仍会使用当前实例自身的模型、TTS、图片/视频等配置**，第三方应用不需要直接传模型参数。
5. **如果启用了登录保护**，外部跳转可能需要先登录 OpenMAIC。

---

## 一个完整例子

### 第三方应用的输入

```json
{
  "title": "机器学习入门",
  "markdown": "# 机器学习入门\n\n## 1. 什么是机器学习\n...",
  "sourceApp": "feishu",
  "sourceUrl": "https://example.com/doc/123"
}
```

### 生成跳转链接

```text
https://你的-openmaic-域名/connect/markdown?title=%E6%9C%BA%E5%99%A8%E5%AD%A6%E4%B9%A0%E5%85%A5%E9%97%A8&md64=...
```

### 用户最终看到

- OpenMAIC 自动创建课堂
- 任务完成后自动跳转到课堂页面

---

## 建议你在第三方应用里做的事情

- 给讲义标题一个清晰的显示名
- 对长 Markdown 做 Base64URL 编码
- 如果走服务端直连，保存 `jobId`
- 在课堂完成后把最终课堂链接展示给用户

---

## 相关页面和接口

- 连接页: `/connect/markdown`
- 课堂生成接口: `POST /api/generate-classroom`
- 任务轮询接口: `GET /api/generate-classroom/{jobId}`
- 课堂页面: `/classroom/{classroomId}`
