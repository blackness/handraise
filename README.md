# HandRaise

Real-time live session engagement for hybrid learning and corporate training.

## Setup

### 1. Supabase

1. Create a new Supabase project at https://supabase.com
2. Go to **SQL Editor** and run `handraise_migration.sql` (the main schema)
3. Then run `student_login_function.sql` (PIN auth RPC function)
4. Create your platform owner user:
   - Dashboard → Authentication → Users → Add User
   - Copy the UUID, then run the seed inserts from Section 15 of the migration file
5. Go to **Storage** → profile-photos → Settings → make bucket **Public**

### 2. React App

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key
# Find these in: Supabase Dashboard → Settings → API

# Start dev server
npm run dev
```

### 3. Environment Variables

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon public key |

## Routes

| Path | Role | Description |
|---|---|---|
| `/login` | Admin / Teacher | Email + password login |
| `/join` | Student | Student ID + PIN login |
| `/platform` | Platform Owner | Institution management |
| `/admin` | Admin | Session control, student management |
| `/teacher` | Teacher | Live session dashboard |
| `/session` | Student | Hand raise + poll UI |
| `/presenter/:sessionId` | Anyone (projector) | Live poll results display |

## Project Structure

```
src/
├── lib/
│   └── supabase.js          # Supabase client singleton
├── contexts/
│   └── AuthContext.jsx      # Auth state for all roles
├── components/
│   └── RequireAuth.jsx      # Route guard
├── pages/
│   ├── LoginPage.jsx        # Admin/teacher login
│   ├── StudentLoginPage.jsx # Student PIN login
│   ├── PresenterScreen.jsx  # Projector display
│   ├── platform/            # Platform owner pages
│   ├── admin/               # Admin pages
│   ├── teacher/             # Teacher pages
│   └── student/             # Student pages
└── index.css                # Tailwind + global styles
```

## Build Phases

- **Phase 1** (Weeks 1–4): Admin panel, student management, CSV import, session gate, hand raise, attendance, PWA
- **Phase 2** (Weeks 5–8): Polls, confidence checks, presenter screen, reactions
- **Phase 3** (Weeks 9–12): Analytics, reporting, self-serve onboarding
