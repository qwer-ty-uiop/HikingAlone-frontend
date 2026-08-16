# Hiking Alone Frontend

## 项目概述

这是一个基于 React + Vite + Tailwind CSS 的高标准徒步应用前端项目，采用现代设计美学和最佳实践。

## 技术栈

- **React 18** - UI 框架
- **Vite** - 构建工具
- **Tailwind CSS 3** - 样式框架
- **TypeScript** - 类型安全
- **Lucide React** - 图标库

## 安装依赖

```bash
npm install
```

## 开发模式

```bash
npm run dev
```

## 构建生产版本

```bash
npm run build
```

## 项目结构

```
src/
├── components/
│   └── HomePage.tsx    # 首页组件
├── types/
│   └── index.ts        # TypeScript 类型定义
├── App.tsx             # 主应用组件
├── main.tsx            # 应用入口
└── index.css           # 全局样式
```

## 设计特点

遵循 `design-taste-frontend-v1` 技能规范：

- **设计方差** (8): 非对称布局，打破常规
- **运动强度** (6): 流畅的 CSS 动画和交互
- **视觉密度** (4): 舒适的日常应用布局
- **字体**: Geist, Satoshi, Outfit, Cabinet Grotesk
- **颜色**: Zinc/Slate 中性色系 + 单一强调色
- **布局**: CSS Grid 代替复杂 Flexbox 百分比计算

## 接口说明

项目通过代理调用后端接口：

```
GET /index  → 获取首页数据
```

## API 返回格式

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "systemInfo": { "name": "Hiking Alone", "version": "1.0.0" },
    "statistics": {
      "todayUsers": 1250,
      "thisMonthRoutes": 86,
      "currentlyWalking": 342,
      "completedWalkers": 15800
    },
    "hotRoutes": [...],
    "activities": [...],
    "news": [...],
    "features": [...],
    "user": {...},
    "notices": [...]
  },
  "timestamp": 1694631000000
}
```

## 浏览器支持

- Chrome (最新版)
- Firefox (最新版)
- Safari (最新版)
- Edge (最新版)
