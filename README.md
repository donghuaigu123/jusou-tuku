# 聚搜图库 · JuSou TuKu

一款 Android 图片聚合搜索与下载工具：输入一句话描述想要的图片，自动并发检索多个搜索引擎与图库，把结果**去重后按「热门程度 + 贴近搜索词的程度」聚合排序**，最多展示 100 张；支持大图查看、自定义下载目录，并内置完整的「纹身线稿大师」线描稿生成功能。

- **APK 体积约 109 KB**，纯 Android framework API，无 AndroidX、无第三方库、无广告、无后台上传。
- 线稿算法全部在本机计算，图片不会上传到任何服务器。
- 开源协议：MIT。

| 聚合搜索 | 大图查看 | 线稿工作台 | 设置 |
| :---: | :---: | :---: | :---: |
| ![聚合搜索](docs/screenshot-search.png) | ![大图查看](docs/screenshot-viewer.png) | ![线稿工作台](docs/screenshot-stencil.png) | ![设置](docs/screenshot-settings.png) |

> 想先在电脑上看界面？打开仓库根目录的 [`preview.html`](preview.html)（单文件、模拟数据、可点击交互）。生成方式见「自行构建」。

---

## 功能

- **多源聚合**：一次搜索并发请求 13 个来源，任一来源超时/失败不影响其它来源，界面会显示每个来源的命中数与失败原因。
- **智能排序**：综合分 = `0.55 × 相关度 + 0.45 × 热门度`。可一键切换「综合推荐 / 热门优先 / 最贴题」。
  - 相关度：标题与搜索词的分词匹配（含中文 2-gram）、完整词命中、源内排名。
  - 热门度：源内排名衰减 + 图库返回的浏览/下载/点赞数 + **被多个来源同时命中的次数**。
- **去重 + 上限 100**：按规范化 URL 去重（自动忽略签名、时效等追踪参数），默认最多 100 张，可在设置里调为 10～100。
- **看图**：全屏查看器，左右切换、双击缩放、显示来源 / 尺寸 / 授权 / 三项评分，可跳转到来源网页。
- **下载目录自定义**：通过系统文件选择器指定任意目录（SAF 持久化授权），可再设子文件夹名；未指定时写入系统「下载 / 聚搜图库」。支持 Android 10+ 分区存储。
- **防盗链处理**：所有图片经应用内本地代理转发，自动附加 UA 与 Referer，并做磁盘缓存。
- **纹身线稿工作台**：复刻 [tattoo-stencil-maker](https://github.com/donghuaigu123/tattoo-stencil-maker) 的完整算法与参数，把任意图片转成「纯白底 + 纯黑线」的转印底稿。支持把搜到的图片一键送进工作台。
- **下载记录**：本机保存文件名、路径、时间，可随时回看。

---

## 安装

1. 从 [Releases](https://github.com/donghuaigu123/jusou-tuku/releases) 下载 `jusou-tuku-v1.0.0.apk`（或直接用仓库 `apk/` 目录里的文件）。
2. 在 Android 手机上点击安装；系统提示「未知来源」时允许即可。
3. 要求 **Android 7.0（API 24）及以上**。安装后首次打开无需登录、无需授权网络之外的权限。

> 应用需要 `INTERNET` 权限用于检索图片。写公共下载目录的 `WRITE_EXTERNAL_STORAGE` 仅在 Android 9 及以下声明且生效；Android 10+ 使用 MediaStore / SAF。

---

## 支持的图片来源

| 来源 | 类型 | 是否需要 Key | 说明 |
| --- | --- | --- | --- |
| 必应图片 | 搜索引擎 | 否 | 国内自动走 `cn.bing.com`，解析 `images/async` 结果 |
| 搜狗图片 | 搜索引擎 | 否 | 解析页面内联 `__INITIAL_STATE__` |
| 360 图片 | 搜索引擎 | 否 | 解析页面内联结果数组 |
| 百度图片 | 搜索引擎 | 否 | `acjson` 接口，部分网络会触发反爬，失败自动跳过 |
| DuckDuckGo | 搜索引擎 | 否 | 两步获取 `vqd` 后请求 `i.js`，best-effort |
| Google 图片 | 搜索引擎 | 否 | HTML 抽取，可能被限流，默认关闭 |
| Openverse | 开放图库 | 否 | 聚合 Flickr / Wikimedia 等 CC 授权图片，附授权信息 |
| Wikimedia Commons | 开放图库 | 否 | MediaWiki API，附授权信息 |
| Flickr | 开放图库 | 否 | 公共 feed（按标签检索） |
| NASA 图库 | 开放图库 | 否 | NASA Images API，默认关闭 |
| Pixabay | 商业图库 | **是** | 返回浏览量/下载/点赞，热门排序最准确 |
| Pexels | 商业图库 | **是** | 官方 API |
| Unsplash | 商业图库 | **是** | 官方 API，附点赞数 |

在「设置 → 图源」里可自由开关；填入商业图库 API Key 后对应来源自动启用。Key 只保存在本机 `SharedPreferences`，不会上传。

> **重要**：除官方开放 API（Openverse / Wikimedia / Pixabay / Pexels / Unsplash / NASA）外，搜索引擎部分是**对公开网页结果的解析**，并非官方授权接口。对方改版、限流或反爬时对应来源会自动跳过，其它来源不受影响。请把失败来源当作「尽力而为」的补充。

---

## 聚合与排序怎么算

`SearchEngine.java` 是纯 Java 实现，不依赖 Android，可直接在桌面 JVM 上跑：

1. **并发抓取**：固定线程池同时请求所有启用的来源，每个来源单独超时（8～9 秒），整体 14 秒截止。
2. **统一模型**：所有结果转成 `ImageItem`（标题、缩略图、原图、来源页、尺寸、授权、源内排名、原始热度）。
3. **去重**：规范化 URL（去协议、去 `x-expires` / `x-signature` / `_iz` / `from` 等追踪参数）后按 MD5 去重；重复命中会累计 `multiSourceHits`。
4. **打分**：
   - `relevance`：搜索词分词（英文按词、中文按 2-gram）与标题的加权匹配率 + 完整词命中 + 源内排名加成。
   - `popularity`：源内排名衰减 `1/(1+rank×0.075)`；若有真实热度数据则与 `log10(1+热度)` 融合；再叠加多源命中加成（最多 +0.18）。
   - `score = 0.55 × relevance + 0.45 × popularity`。
5. **排序 + 截断**：按所选模式降序，截断到设置的上限（≤ 100）。

前端切换排序时使用后端返回的三个分值本地重排，不重复请求网络。

---

## 下载与自定义目录

- 点「选择自定义目录」→ 系统文件选择器（SAF `ACTION_OPEN_DOCUMENT_TREE`）→ 应用申请**持久化 URI 授权**，之后所有下载直接写入该目录，Android 11+ 的分区存储限制同样适用。
- 「子文件夹名称」留空表示直接存到所选目录；填写则在目录内自动创建同名子目录。
- 未提供自定义目录时：Android 10+ 通过 `MediaStore.Downloads` 写入 `下载/聚搜图库/`，Android 9 及以下写公共下载目录。
- 若系统回收了目录授权，会自动回退到默认目录并在界面上更新显示，不会让下载失败。

---

## 纹身线稿工作台

完整移植自开源项目 [纹身线稿大师 / tattoo-stencil-maker](https://github.com/donghuaigu123/tattoo-stencil-maker)（MIT），算法源码见 `StencilProcessor.java`，仅修改包名。处理管线：

灰度 + 轻度模糊 → 大尺度背景漂白 → 局部均值差分提取深色勾线 → 亮度门控 → 多通道 Sobel 边缘融合 → 高分位归一化二值化 → 连通域去噪 → 输出只有 `0x000000` / `0xFFFFFF` 的 ARGB_8888 PNG。

可调参数与原项目一致：

| 参数 | 作用 |
| --- | --- |
| 线条预设（细线 / 标准 / 浓线） | 阈值、边缘权重、膨胀核 |
| 线条强度 0～100 | 整体线条显现多少 |
| 细节保留 0～100 | 细小/孤立笔画（胡须、睫毛、斑点）保留程度；50 档与原项目默认逐像素一致 |
| 深色背景净化 | 是否漂白大片深色背景 |

另提供「原图 / 线稿 / 拖动分割线对比」三视图，以及保存 PNG、分享。**所有计算在本机完成，图片不联网、不上传。**

在查看器里点「✒ 转线稿」即可把搜到的图片直接送进工作台。

---

## 技术架构

```
MainActivity (WebView)
   └── http://127.0.0.1:<随机端口>/     ← LocalServer（仅监听回环，校验 Host）
         ├── 静态资源 assets/index.html / app.css / app.js
         ├── GET  /api/search          多源聚合（SearchEngine）
         ├── GET  /api/img?u=...       图片代理（加 UA/Referer + 磁盘缓存，绕开防盗链）
         ├── GET  /api/download        下载到自定义目录（DownloadManager / SAF）
         ├── GET|POST /api/settings    设置与 API Key
         ├── POST /api/stencil         调用 StencilProcessor 生成线稿
         ├── POST /api/save-image      保存线稿 PNG
         └── GET  /api/picked/*        相册选图暂存（避免 JS 桥传输大 base64）
```

**为什么用本地服务而不是 `file://` + JS 桥**：页面与 API 完全同源，没有 CORS / Mixed Content 问题；第三方图片统一代理可绕开防盗链；大图与选图走 HTTP 而非 Binder 事务，不受 1 MB 限制。服务只绑定 `127.0.0.1`、端口随机、校验 Host，不对外暴露。

`Android` JS 桥仅用于少量原生能力：选择目录、选择相册图片、打开外部链接、分享、Toast、退出。

---

## 自行构建

### 方式 A：命令行轻量构建（推荐）

需要 Android SDK 的 `platforms;android-35` 与 `build-tools;35.0.0`，以及 JDK 8+：

```bash
export ANDROID_SDK_ROOT=/path/to/android-sdk
bash scripts/build-apk.sh
# 产物：apk/jusou-tuku-v1.0.0.apk
```

脚本依次完成 `aapt2 compile/link（含 assets）→ javac → d8 → 打包 dex → zipalign → apksigner`。签名密钥生成在 `.keystore/` 并复用，因此重复构建可覆盖升级（该目录不入库）。

### 方式 B：桌面端聚合引擎集成测试

`SearchEngine` / `Json` / `Net` / `ImageItem` 都是纯 Java，可以脱离 Android 直接对真实图源跑一次搜索：

```bash
cd jusou-tuku
mkdir -p /tmp/jusou-test
javac --release 8 -encoding UTF-8 -d /tmp/jusou-test \
  app/src/main/java/com/donghuaigu/jusou/{Json,Net,ImageItem,SearchEngine}.java \
  scripts/SearchEngineTest.java
java -cp /tmp/jusou-test SearchEngineTest '纹身 线稿'
```

会打印每个来源的命中数、耗时、错误信息，以及综合排序 Top 8。开发机上实测：必应 35 / 搜狗 40 / 360 共 40 / 百度 40 条，去重后 100 张，耗时约 0.9 秒。

### 方式 C：生成浏览器演示页

```bash
python3 scripts/make-preview.py preview.html
# 打开 preview.html 即可在无 Android 设备时查看界面与交互（模拟数据）
```

---

## 项目结构

```
app/src/main/
├── java/com/donghuaigu/jusou/
│   ├── MainActivity.java        WebView 容器、相册选图、目录选择 JS 桥
│   ├── LocalServer.java         本地 HTTP 服务与全部 /api 路由
│   ├── SearchEngine.java        13 个来源适配器 + 去重 + 打分 + 排序（纯 Java）
│   ├── Json.java / Net.java     轻量 JSON 与 HTTP 客户端（纯 Java）
│   ├── ImageItem.java           统一结果模型（纯 Java）
│   ├── Settings.java            下载目录、图源开关、API Key、排序偏好
│   ├── DownloadManager.java     SAF 自定义目录 + MediaStore 默认目录
│   ├── StencilBridge.java       线稿算法接入
│   └── StencilProcessor.java    移植自 tattoo-stencil-maker（MIT）
├── assets/                      index.html / app.css / app.js（单页界面）
├── res/                         图标、主题、字符串
└── AndroidManifest.xml
scripts/
├── build-apk.sh                 轻量构建
├── make-preview.py              生成浏览器演示页
└── SearchEngineTest.java        桌面端集成测试
docs/                            图标与界面截图
apk/                             已签名可安装的 APK
```

---

## 已知限制

- 搜索引擎网页解析会随对方改版失效；百度、Google、DuckDuckGo 在部分网络下会被反爬并自动跳过。
- Openverse / Wikimedia / Flickr / Google 等国际源需要能访问相应服务；国内网络建议保留必应、搜狗、360、百度四个主力源。
- 商业图库需自行申请免费 API Key。
- 图片防盗链无法 100% 绕过，个别图片可能加载失败（查看器会自动回退到缩略图）。
- 线稿算法针对「浅色载体上的深色勾线图案」设计，对照片类复杂纹理的效果取决于原图对比度。

---

## 版权与合规

- 聚合结果来自第三方公开搜索服务，**图片版权归原作者所有**。请遵守各站点的服务条款与授权要求（Openverse / Wikimedia 结果会显示授权信息），勿用于商业侵权用途。
- 本项目不托管、不缓存、不二次分发任何图片到本地以外的服务器；图片缓存仅存在于应用私有缓存目录。
- 本项目是独立的开源工具，与文中提到的任何搜索引擎或图库没有隶属或授权关系。

---

## 许可证与致谢

- 本项目：MIT License，见 [LICENSE](LICENSE)。
- 线稿算法：[donghuaigu123/tattoo-stencil-maker](https://github.com/donghuaigu123/tattoo-stencil-maker)，MIT License，Copyright (c) 2026 donghuaigu123。
- 构建脚本思路同样参考该项目的轻量 `aapt2 → d8 → apksigner` 流程。
