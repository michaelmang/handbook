# Handbook Builder

Assemble institutional handbooks from Markdown sections — import, organize, style, and export to PDF or Word.

Built for school administrators who stitch together policy documents from scattered drafts each year.

## Features

- **Import** — Drag-and-drop or paste Markdown files (one per section)
- **Organize** — Drag-and-drop reordering, chapter grouping, exclude sections without deleting
- **Style** — Three templates (Classic, Modern, Compact), school branding, logo, accent color
- **Preview** — Live scrollable preview of the assembled document
- **Export** — Polished PDF and Word (.docx) downloads
- **Persistence** — Projects auto-save in the browser; export/import project files for backup

## Tech Stack

- [Next.js](https://nextjs.org/) 16 (App Router) + React + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) 4
- [Zustand](https://zustand.docs.pmnd.rs/) for state + localStorage persistence
- [@dnd-kit](https://dndkit.com/) for drag-and-drop
- [remark](https://remark.js.org/) for Markdown parsing
- [docx](https://docx.js.org/) for Word export
- [Puppeteer](https://pptr.dev/) + [@sparticuz/chromium](https://github.com/Sparticuz/chromium) for PDF export on Vercel

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Sample content

The `samples/` directory contains example Markdown sections you can import to try the workflow:

- `mission-statement.md`
- `attendance-policy.md`
- `dress-code.md`

### PDF export (local development)

PDF generation uses Puppeteer with your local Chrome installation. On macOS, it looks for Chrome at:

```
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

Word export works without any additional setup.

## Deploy to Vercel

1. Push this repository to GitHub
2. Import the project in [Vercel](https://vercel.com/new)
3. Vercel auto-detects Next.js — no extra configuration needed
4. PDF export uses `@sparticuz/chromium` in production (configured in `vercel.json`)

### GitHub → Vercel pipeline

Vercel's GitHub integration deploys automatically on every push to your default branch. Preview deployments are created for pull requests.

## Project structure

```
src/
├── app/                  # Next.js routes
│   ├── api/export/       # PDF and DOCX export endpoints
│   ├── project/[id]/     # Handbook editor
│   └── page.tsx          # Project list / home
├── components/           # UI components
└── lib/                  # Types, store, markdown, templates, export
samples/                  # Example Markdown sections
```

## Roadmap (from spec)

- [x] Phase 1 — Import, reorder, default template, PDF export
- [x] Phase 2 — Multiple templates, branding, Word export, live preview
- [x] Phase 3 — Project save/reopen, duplicate for next year
- [ ] Phase 4 — Post-validation features (acknowledgment tracking, collaboration)

## License

Private — all rights reserved.
