<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Delivery workflow

The user requests that each completed change be committed and pushed to GitHub `origin/main` after verification, followed by checking the connected Vercel deployment. This is standing authorization; do not ask for deployment confirmation each time. Incorporate newer remote changes before pushing and do not force-push.
