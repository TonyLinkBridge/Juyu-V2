// Adapted from the GitBook footer's branding, theme and legal sections.
import {ThemeToggler} from '../ThemeToggler/ThemeToggler';
export function Footer() {
  return <footer data-gb-site-footer="" className="site-footer">
    <div className="footer-copy"><strong>JUYU · 为团队保存可靠的答案</strong><span>仅限经授权的公司成员访问</span></div>
    <ThemeToggler/>
  </footer>;
}
