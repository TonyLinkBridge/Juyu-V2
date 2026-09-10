# T012 · 员工登录本地验收

日期：2026-09-08；工程 /Users/tony/Documents/ChatGPT/Juyu V2。

## 范围和批准

沿已确认的 T012 清单接入现有员工登录入口；用户本轮明确回答“还没有，先完成本地接入”。未连接真实 Clerk 或 Supabase，未创建实例/真实账号，未部署。T012 整体保留进行中，真实账号验收待测试项目。

## 结果

- npm test：76/76 通过，0 失败、0 跳过。相比 T011 新增 9 项会话测试及 1 项 APP_ORIGIN 配置测试。
- npm run test:e2e：12/12 通过，桌面 6、手机 6；真实本地 Next.js production build，密钥未配置。
- npm run build、npm run typecheck、npm run lint：最终退出码 0。
- 构建包含 /sign-in/[[...sign-in]]、/sign-in/error、动态员工入口和 Proxy。
- 最终预览在 127.0.0.1:3211；实际附件 API 发送伪造角色及会话仍返回 503、no-store。
- 登录恢复页面实际桌面/手机截图：output/verification/login-error-desktop.png、login-error-mobile.png；已查看手机截图，文字与按钮完整，无横向溢出。
- 数据库业务代码未改变，本轮未重跑数据库套件；此前 T011 的 41 项数据库结果不算本轮新证据。

## 验证内容

配置缺失不调用身份服务；格式不符、模式不符、密钥首尾空格、无效网站 origin 拒绝。匿名及不完整身份不创建会话；active 会话只输出 userId/sessionId；撤销、过期、pending、ID 不匹配被拒绝。每次检查重新取服务端会话状态，供应商异常转为无敏感详情的错误状态。退出调用只带当前会话 ID 与固定站内地址，失败继续抛出供 UI 告知用户。

桌面/手机实测：根地址直接员工登录，无后台选择；管理员入口仍关闭；404 可恢复；健康接口不冒充就绪；登录恢复不回显 query 中的 secret 文本，重试回站内；Clerk 子路径可到达未连接页面，伪造会话和外站 return URL 不放行 /help-centre。

这些会话单元测试使用供应商测试替身，不是签名或真实 Clerk 服务验收。浏览器测试覆盖未配置分支；已配置后的官方登录组件、真实 OAuth 回调和退出流程仍未实测。

## 修复记录

- 新功能测试初次因对应模块尚未实现而失败，完成后通过。
- 路由迁移后首次 typecheck 引用旧生成路径 src/app/sign-in/page.js；重新构建生成新路由类型后通过，没有恢复冲突的旧路由。
- 登录失败重试需要完整刷新来重新加载 Clerk Provider，保留原生链接并记录局部 lint 例外；最终 lint 通过。
- 独立审查发现密钥 trim 校验与 SDK 原值读取不一致；新增空白密钥测试先观察失败，再明确拒绝空白，修复后独立复核 9 项会话测试通过。
- 发现整体准备检查遗漏新增 APP_ORIGIN；补测试先观察错误的 present，再加入 required/安全 origin 检查，最终全集通过。

## 待办

1. 真实 Clerk 测试账号登录/退出、会话撤销、错误/断网恢复、恶意 redirect_url、两个会话仅退出当前会话。
2. T013 公司邮箱和 Slack Workspace 服务端校验；随后 T014 管理员入口与 T015 角色/成员接入。
3. 真实 Clerk + 公司身份绑定受限数据库；在此之前业务授权仍关闭，即使 Clerk 已登录也只显示待开通提示。

模块说明：src/server/authentication/README.md。不会将本地代码、真实云端验收和上线合并成一个“完成”。
