# Antevus Product Application

The core product dashboard for Antevus - Universal Laboratory Instrument API Platform.

## Overview

This is the main product application for Antevus customers, providing a comprehensive dashboard for managing laboratory instruments, viewing real-time data, and controlling API integrations. Deployed at [app.antevus.com](https://app.antevus.com).

## Key Features

### Phase 1 - Demo-Ready Frontend MVP
- 🔬 **Instrument Dashboard**: Real-time grid view of all connected instruments
- 📊 **Run History**: Searchable log of all instrument runs with data preview
- 🔑 **API Management**: Generate and manage API keys for integrations
- 📈 **Real-time Monitoring**: Live status updates and telemetry charts
- 🏢 **Organization Management**: Multi-tenant support with team collaboration
- 🔐 **Secure Access**: Enterprise-grade authentication and authorization

### Coming Soon (Phase 2)
- 🤖 Remote instrument control capabilities
- 📅 Scheduling and queue management
- 🔄 Webhook configuration
- 📋 Compliance audit logs
- 🔗 One-click ELN/LIMS integrations

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

Copyright © 2025 Antevus. All rights reserved.