# Antevus Developer Setup Guide

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/gabeviggers/antevus.git
   cd antevus
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys (optional for development)
   ```

5. **Run the development server**
   ```bash
   npm run dev
   # App will be available at http://localhost:3000
   ```

## Project Structure

```
antevus/
├── src/
│   ├── app/               # Next.js 14 app directory
│   │   ├── layout.tsx     # Root layout
│   │   ├── page.tsx       # Home page
│   │   └── globals.css    # Global styles
│   ├── components/
│   │   └── ui/           # Radix UI components
│   └── lib/              # Utility functions
├── public/               # Static assets
├── .env.example         # Environment variables template
├── .env.local          # Local environment variables (gitignored)
├── docker-compose.yml  # Local database setup
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── CLAUDE.md            # Project context for AI assistants
├── IMPLEMENTATION_ROADMAP.md  # Development roadmap
└── SETUP_GUIDE.md       # This file

```

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v3
- **UI Components**: Radix UI
- **State Management**: React Query (to be added)
- **Charts**: Recharts (to be added)

### Backend (To be implemented)
- **API**: FastAPI (Python) or Next.js API Routes
- **Database**: PostgreSQL + TimescaleDB
- **Cache**: Redis
- **Message Queue**: Kafka (future)

### DevOps & Tools
- **Deployment**: Vercel
- **CI/CD**: GitHub Actions
- **Error Tracking**: Sentry
- **Analytics**: PostHog
- **Code Quality**: ESLint, Prettier, Husky

## Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
npm run test       # Run tests (to be configured)
```

## Local Database Setup

If you need to run the databases locally:

```bash
# From the antevus/antevus directory
docker-compose up -d

# This starts:
# - PostgreSQL on port 5432
# - Redis on port 6379
# - TimescaleDB on port 5433
```

## Environment Variables

### Required for Development
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NODE_ENV=development
ENABLE_MOCK_DATA=true
```

### Optional (for full features)
- `NEXT_PUBLIC_SENTRY_DSN` - Error tracking
- `NEXT_PUBLIC_POSTHOG_KEY` - Analytics
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection

See `.env.example` for the complete list.

## Git Workflow

### Pre-commit Hooks
The project uses Husky for pre-commit hooks that:
- Run ESLint to check for code issues
- Run Prettier to format code
- Ensure TypeScript compiles without errors

### Branch Strategy
- `main` or `master` - Production-ready code
- `develop` - Integration branch
- `feature/*` - New features
- `fix/*` - Bug fixes

### Commit Messages
Follow conventional commits:
```
feat: Add instrument dashboard
fix: Resolve data loading issue
docs: Update setup guide
chore: Update dependencies
```

## Common Issues & Solutions

### Issue: "npm error ENOENT"
**Solution**: Make sure you're in the project root directory with the package.json file.

### Issue: Port 3000 is already in use
**Solution**: The app will automatically use port 3001. Or kill the process:
```bash
lsof -ti:3000 | xargs kill -9
```

### Issue: Tailwind CSS PostCSS error
**Solution**: We're using Tailwind v3. If you see v4 errors, ensure postcss.config.js uses:
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},  // Not @tailwindcss/postcss
    autoprefixer: {},
  },
}
```

### Issue: TypeScript errors
**Solution**: Run `npm run build` to see all TypeScript errors, then fix them.

## VS Code Recommended Extensions

Create `.vscode/extensions.json`:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "christian-kohler.npm-intellisense"
  ]
}
```

## Testing

### Unit Tests (To be configured)
```bash
npm run test
```

### E2E Tests (To be configured)
```bash
npm run test:e2e
```

## Deployment

### Vercel (Automatic)
Pushes to `main` automatically deploy via GitHub integration.

### Manual Deployment
```bash
vercel --prod
```

## Monitoring

### Error Tracking
Errors are automatically sent to Sentry. View them at:
- Development: Check console
- Production: Sentry dashboard

### Analytics
User events are tracked via PostHog:
- Page views
- Button clicks
- Feature usage

## Getting Help

1. **Check the docs**: Read CLAUDE.md and IMPLEMENTATION_ROADMAP.md
2. **GitHub Issues**: https://github.com/gabeviggers/antevus/issues
3. **Contact**: gabeviggers@gmail.com

## Next Steps for New Developers

1. ✅ Complete this setup
2. 📖 Read CLAUDE.md to understand the product vision
3. 📋 Check IMPLEMENTATION_ROADMAP.md for current priorities
4. 🎨 Start with Phase 1: Build the instrument dashboard UI
5. 🧪 Add mock data and interactions
6. 🚀 Ship fast, iterate based on feedback

## License

Proprietary - Antevus © 2024