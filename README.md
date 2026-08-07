# Planar Map Marker

基于 Leaflet Simple CRS 的平面地图标点系统。在自己上传的楼层底图（png/svg）上做点位、多边形和路网标注，并导出为 GeoJSON 或可迁移的项目压缩包。

纯前端应用，零后端——所有数据存在浏览器 IndexedDB 里。

## 开发

```bash
pnpm install
pnpm dev          # 开发服务器
pnpm build        # 生产构建（先 tsc -b 再 vite build）
pnpm preview      # 预览构建产物
```

## 质量检查

```bash
pnpm lint         # Biome 检查（lint + 格式）
pnpm lint:fix     # Biome 自动修复
pnpm typecheck    # tsc 类型检查
pnpm test         # Vitest 跑一遍
pnpm test:watch   # Vitest watch 模式
```

跑单个测试文件：

```bash
pnpm vitest run src/lib/theme.test.ts
pnpm vitest run -t "resolveTheme"     # 按测试名过滤
```

## 技术栈

| 领域 | 选型 |
|---|---|
| 构建 | Vite 8 + React 19 + TypeScript 6（strict + noUncheckedIndexedAccess） |
| UI | shadcn/ui（base-nova style，基于 base-ui）+ Tailwind CSS 4 |
| 地图 | Leaflet 1.9（`L.CRS.Simple`）+ geoman-free 负责点/多边形绘制 |
| 存储 | Dexie（IndexedDB） |
| 状态 | Zustand + Immer，变更走命令层以统一持久化与撤销/重做 |
| 校验 | Zod，用户定义的 Schema 在运行时编译成 Zod object |
| 表单 | react-hook-form + `@hookform/resolvers` |
| 导出 | JSZip + file-saver |
| 质量 | Biome（lint + format 一体）、Vitest |

## 架构约定

**像素坐标是唯一真源。** 所有持久化与导出数据一律用图片像素坐标（原点左上，x 向右，y 向下）。只有渲染和交互时才转换成 Leaflet 的 `LatLng`，转换集中在 `src/lib/`（见 `coords`）。

**`src/domain/` 保持纯净。** 领域层不 import React、不 import Leaflet、不碰 DOM，只有 Zod 模型和纯函数。Leaflet 的副作用集中在 `src/map/`。

**保留键以 `_` 前缀。** 导出时系统注入的属性（`_kind` / `_id` / `_source` / `_target` 等）统一加下划线；Schema 编辑器禁止用户创建 `_` 开头的字段 key。

**`src/components/ui/` 是 shadcn CLI 生成的，Biome 不对其做 lint**（只做格式化），因为 CLI 会重新生成这些文件。目前对生成结果有两处手工改动：`sonner.tsx` 改用本项目的 `useTheme`（而非 next-themes），`scroll-area.tsx` 删掉了未使用的 React import。

## 添加 shadcn 组件

```bash
pnpm dlx shadcn@latest add <component>
pnpm lint:fix     # 生成的文件按本项目风格重新格式化
```

预设为 `b6F9Pikvg`（已写入 `components.json`）。
