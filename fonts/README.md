# Server-rendered Chinese text

NotoSansSC.ttf is the unmodified variable Noto Sans SC font from Google Fonts:
https://github.com/google/fonts/tree/main/ofl/notosanssc

Downloaded 2026-09-12. SHA-256:
`a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da`

The included OFL.txt permits redistribution. Keep it with the font.

Next traces this directory only into PDF/diagram functions. The packaged Chromium
fontconfig includes /var/task/fonts. Fonts are local files; document rendering
remains offline and never sends private text to a font provider.

The npm Chromium binary is Linux x64. Vercel runs this path; local macOS continues
to use the installed Playwright browser. Validate the pinned Chromium 153 / Playwright
1.62.1 combination in the actual Linux deployment before marking R16 complete.
