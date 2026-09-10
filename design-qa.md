# 登录页设计核对

- source visual truth: `/Users/tony/.codex/generated_images/01a07e8f-7d3d-7913-ae5a-b945e4845a98/exec-65132a1a-a550-4da3-8974-5488009b8a89.png`（亮版）及 `exec-b658ed23-47c0-472f-80b1-9a6c4e512495.png`（同目录，暗版）。
- implementation: `http://127.0.0.1:3212/design-preview/login-light` / `login-dark`，开发专用外观预览，不是已登录页面。
- viewport / density: 源图 1487×1058；实现 1487×1058 CSS px，deviceScaleFactor 1，实际截图同尺寸。整体比较统一降采样为每侧 744×529；局部保留 1:1。
- state: 未登录、亮/暗入口；手机 390×844，邮箱折叠及展开。
- implementation screenshots: `output/verification/login-layout/{light,dark}.png`、`{light,dark}-mobile.png`、`{light,dark}-email-mobile.png`。
- full-view comparison: `output/verification/login-layout/{light,dark}-comparison.png`，左源图、右实现。
- focused comparison: `output/verification/login-layout/{light,dark}-detail.png`，左源图、右实现；登录主操作与文字区域。

## Findings / comparison history

1. 初次比较发现 [P2] 内容过于靠左，额外英文眉题偏离所选图。改为居中限制的双栏布局，删除额外眉题，邮箱入口改为左对齐。
2. 精确匹配源图尺寸后发现 [P2] 图形、Logo 和按钮比例偏小。将 Logo 调为 140px、主按钮区域 470px、桌面高度 68px，图形在大屏扩大 1.24 倍；标题调至最高 56px；重新截图对照。
3. 最终整体及局部核对：没有阻断本地外观预览的 P0/P1/P2。手机隐藏装饰图，主要操作保持首屏可见，展开邮箱后无横向溢出。

## Required fidelity surfaces

- Fonts / typography：使用项目原有系统中文字体，单一 h1；字号/字重/行距形成清晰层级。AI 源图中文字笔画和阴影不能精确等同真实字体；属于可接受的轻微差异。
- Spacing / layout：左登录、右静态图形，顶部入口切换、底部准入说明；手机单栏。无卡片套卡片。
- Colors / tokens：员工暖白 + 红色主按钮；管理员炭黑 + 白色主按钮；登录入口不随资料库主题意外变色。暗版使用项目已有白色 Logo。
- Image quality：独立生成并压缩的 WebP 图形，不是截图背景铺满；无重型动画或 CSS 绘制图形。与来源雕塑存在轻微材质/光照差异，保留同一设计方向。
- Copy / content：标题、说明和入口区别与选定设计一致；预览 Slack 图标已改用官方彩色原始标志（public/brand/slack-color.svg）；实际登录仍使用 Clerk 提供的原生供应商控件。

## Interaction checks / limitations

- 预览可展开/收起邮箱，点击 Slack 明确提示预览不启动真实登录。
- 组件测试验证正式 EmployeeLogin 的固定跳转参数、初始邮箱折叠、错误提示、后续步骤展示与连接失败状态；Clerk 在测试中模拟。
- 本地预览 pageerror: 0。
- 最终 78 项相关桌面/手机浏览器检查、343 项单元检查、构建与静态检查通过。
- 生产 Clerk 动态控件、真实 OAuth/MFA/注册转接与上线性能尚未在本轮验收。本地外观通过不代表生产认证验收完成。

## Follow-up polish

[P3] 如需逐像素接近 AI 图片，可进一步统一特定品牌字体及暗版红白 Logo 素材；当前使用已有品牌资源。

final result: passed

## Slack Logo 修正

Tony 指出原预览单色图标不符合所选图。已替换为 https://docs.slack.dev/img/logos/logo-light.svg 中的四个彩色原始路径，仅裁去文字部分，未重画或改色。内置浏览器已核对亮版、暗版均显示彩色标志。组件静态检查通过；仅本地修改，未部署。旧对照截图保留原状态，不作为本次图标修正后的截图。
