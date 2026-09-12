# R24 媒体链路测量

本地实现，未部署；仅在启用 JUYU_PERFORMANCE_LOGGING=true 时输出。

日志事件 juyu.request-performance，每个附件或PDF请求一条汇总。route只有asset/pdf，不记录具体URL、账号或文件标识。stages下包含count/ms/failures。嵌套阶段耗时不能直接相加；并行请求独立统计。

普通文件请求总耗时到Response就绪为止，不代表浏览器下载完成；storage.headers只计存储响应头等待。PDF的storage.body计图片完整读取，pdf.render计生成等待与渲染。应用创建/路由初始化在包装外，不能把本计时当作全部网络耗时。

本地样例确认普通资产前后各授权一次，单封面PDF共四次授权。identity.verify次数与slack.userinfo实际调用次数必须分别观察；不能从授权次数推断线上Slack次数。

上线后先执行0029迁移再发布应用，短期打开日志。覆盖无图/多图、PDF下载/打印预检、视频Range及撤权失败。比较请求总耗时与供应商、数据库、存储、生成阶段；日志统计完成后关闭开关。不要通过取消复核或跨成员共享身份来缩短等待。

验证：14项日志及存储专项、58项数据库权限检查通过，lint/build通过。未访问正式内容、未修改生产配置、未验证线上提速。
