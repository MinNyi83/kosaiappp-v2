---
name: cloudflare-local-first
description: Enforces running and testing in the local environment first and defers cloud/Cloudflare deployment until the user explicitly requests it.
---
# Cloudflare Local-First Development & Deployment

This skill ensures that all development, running, and testing tasks are performed exclusively in the local environment. Cloudflare production deployment should only be executed when the user explicitly requests it.

## Rules & Guidelines

1. **Local Environment Only**:
   - Always run and test application code locally using Wrangler's local development server (e.g., `npx wrangler dev` or `npm run dev`).
   - Do NOT run production deployment commands like `npx wrangler deploy` or `npm run deploy` unless specifically instructed.

2. **Wait for Deployment Trigger**:
   - Defer Cloudflare cloud deployment until the user explicitly says: **"deploy cloudflare"** or **"deploy to cloudflare"**.
   - If changes need to be verified, prompt the user with local verification steps first.

## 🚀 Deployed Environments

When deployment is explicitly requested, deploy the respective layers using these target endpoints:

1. **Backend API (Cloudflare Workers)**:
   - **Target URL**: `https://cctv-service-system.nyinyimin2007.workers.dev/`
   - **Deployment Command**: `npx wrangler deploy`

2. **Frontend Console (Cloudflare Pages)**:
   - **Target URL**: `https://awesomemyanmar.pages.dev/`
   - **Deployment Command**: `npx wrangler pages deploy ./public --project-name awesomemyanmar`
