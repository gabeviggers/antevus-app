# Antevus App - Product Dashboard

B2B dashboard for laboratory instrument control and API management.

## Overview

This repository contains the product dashboard for Antevus, deployed at [app.antevus.com](https://app.antevus.com).

## Features

- 🔐 Password-protected access for B2B customers
- 🔬 Laboratory instrument control interface
- 📊 Usage analytics and monitoring
- 🔑 API key management
- 📈 Real-time data visualization
- 🏢 Multi-tenant organization support

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS
- **Authentication**: Password protection (NextAuth.js coming soon)
- **Deployment**: Vercel
- **Database**: PostgreSQL (via Supabase/Neon)

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

Create a `.env.local` file:

```env
# Authentication
AUTH_PASSWORD=your_secure_password

# Database
DATABASE_URL=postgresql://...

# API Keys
NEXT_PUBLIC_API_URL=https://api.antevus.com

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Error Tracking
SENTRY_DSN=your_sentry_dsn
```

## Project Structure

```
src/
├── app/
│   ├── dashboard/    # Main dashboard views
│   ├── instruments/  # Lab instrument controls
│   ├── api-keys/     # API key management
│   ├── analytics/    # Usage analytics
│   └── settings/     # Organization settings
├── components/
│   ├── ui/           # Reusable UI components
│   └── dashboard/    # Dashboard-specific components
├── lib/
│   ├── api/          # API client
│   └── utils/        # Utilities
└── middleware.ts     # Authentication middleware
```

## Authentication

Currently using password protection via middleware. Full authentication system with NextAuth.js or Clerk coming soon.

## Related Repositories

- [antevus](https://github.com/gabeviggers/antevus) - Marketing website (antevus.com)
- [antevus-api](https://github.com/gabeviggers/antevus-api) - API backend (api.antevus.com)

## Deployment

This app is deployed on Vercel at app.antevus.com with password protection enabled in production.

## License

Copyright © 2024 Antevus. All rights reserved.