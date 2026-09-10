# 阅读端 21 项功能与原始源码对应表

这些是已定位的原始源码入口，不是已移植或完整依赖清单。实际适配时还需追踪引用的子组件、样式和资源。影片暂定位到 Embed 入口，不据此认定私有视频上传和播放器已经可用。

| 原需求 | 功能 | GitBook 原始文件（components 下） | 实施任务 |
| --- | --- | --- | --- |
| 1 | 左侧文章目录 | `TableOfContents/TableOfContents.tsx`<br>`TableOfContents/PagesList.tsx` | T017 |
| 2 | 目录分组和子目录 | `TableOfContents/PageGroupItem.tsx`<br>`TableOfContents/ToggleableLinkItem.tsx` | T018 |
| 3 | 中央文章阅读区 | `PageBody/PageBody.tsx`<br>`DocumentView/Block.tsx` | T019 |
| 4 | 右侧文章小目录 | `PageAside/PageAside.tsx`<br>`PageAside/ScrollSectionsList.tsx` | T019 |
| 5 | 顶部搜索框 | `Search/SearchInput.tsx` | T020 |
| 6 | 搜索结果页面 | `Search/SearchResults.tsx`<br>`Search/SearchPageResultItem.tsx` | T020 / T041 |
| 7 | 手机版目录菜单 | `Header/HeaderMobileMenu.tsx` | T021 |
| 8 | 面包屑 | `PageBody/PageHeader.tsx`<br>`PageBody/BreadcrumbItemDropdown.tsx` | T022 |
| 9 | 上一篇和下一篇 | `PageBody/PageFooterNavigation.tsx` | T022 |
| 10 | 回到顶部 | `PageAside/ScrollToTopButton.tsx` | T022 |
| 11 | 深色和浅色模式 | `ThemeToggler/ThemeToggler.tsx` | T023 |
| 12 | 公告栏 | `Announcement/AnnouncementBanner.tsx` | T023 / T054 |
| 13 | 页脚 | `Footer/Footer.tsx` | T023 |
| 14 | 文章封面 | `PageBody/PageCover.tsx`<br>`PageBody/PageCoverImage.tsx` | T024 |
| 15 | 文章标签 | `PageBody/PageTags.tsx` | T024 |
| 16 | 文章有帮助吗反馈 | `PageFeedback/PageFeedbackForm.tsx` | T025 |
| 17 | PDF 阅读和导出界面 | `PDF/PDFPage.tsx`<br>`PDF/PrintButton.tsx`<br>`PDF/pdf.css` | T026 |
| 18 | 图片、影片、文件和表格 | `DocumentView/Images.tsx`<br>`DocumentView/Embed.tsx`<br>`DocumentView/File.tsx`<br>`DocumentView/Table/Table.tsx` | T027 |
| 19 | 提示框、代码框和分页标签 | `DocumentView/Hint.tsx`<br>`DocumentView/CodeBlock/CodeBlock.tsx`<br>`DocumentView/CodeBlock/CopyCodeButton.tsx`<br>`DocumentView/Tabs/DynamicTabs.tsx` | T028 |
| 20 | 数学公式和流程图 | `DocumentView/Math.tsx`<br>`DocumentView/CodeBlock/MermaidCodeBlock.tsx` | T029 |
| 21 | 电脑和手机自适应 | `PageBody/PageBody.tsx`<br>`PageAside/PageAside.tsx`<br>`Header/HeaderMobileMenu.tsx` | T021 / T057 |

原始目录：`/Users/tony/Downloads/gitbook-main/packages/gitbook/src/components/`。每个文件的 SHA-256 在 `SOURCES.json` 中；修改后需重新核对，不能沿用旧校验结果。

T027当前适配见T027-media.json：图片/文件沿用原始容器与操作方向；私有原生影片和结构化表格为JUYU新增，未移植供应商Embed接口。后台支持已有资料的正文后内容块及封面选择；完整BlockNote为T031。

T028：四类提示、代码语言标注/原文复制及文字标签页已适配，见T028-rich-blocks.json；保留GitBook容器/面板方向，以本地授权版本与键盘状态替换供应商上下文。PDF展开全部标签，不将复制请求当成功；完整BlockNote与嵌套内容待T031。
