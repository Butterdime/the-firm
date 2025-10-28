# COMPLETE CLAUDE + CURSOR EXECUTION PACKAGE
## Everything Pre-Decided - Just Copy & Execute

---

## Strategic Decisions Made For You

✅ **PostgreSQL**: Railway (automatic backups, no local setup needed)
✅ **Repository**: New - `https://github.com/Butterdime/cis-platform`
✅ **Node.js**: v18+ (modern, supports native fetch)
✅ **ABR API**: Path A - Public API (free, no credentials, ready now)
✅ **Deployment**: Railway backend ($5/month) + Vercel frontend (free tier)
✅ **Scale**: 10 customers/week (comfortable on this stack)

---

## What You Send to Claude in Cursor

### Copy This Exact Message and Paste Into Claude Mac Chat:

```
# CLAUDE: CIS PLATFORM - PHASE 1A EXECUTION (DECISIONS PRE-MADE)

I've made all strategic decisions. Execute Phase 1A immediately with these parameters:

## LOCKED PARAMETERS:
- Database: Railway PostgreSQL (integrated with backend)
- Repository: New - github.com/Butterdime/cis-platform
- Node.js: v18+ (assume user has this)
- npm: v9+ (assume user has this)
- ABR API: Public endpoint (https://data.business.gov.au/data/v1/abn/) - NO CREDENTIALS NEEDED
- Scale: 10 customers/week
- Deployment: Railway + Vercel

## NO MORE QUESTIONS NEEDED
Proceed directly to Phase 1A execution.

## PHASE 1A DELIVERABLE:
Provide exactly these 6 files + 3 terminal commands:

### FILE 1: package.json
- Express.js
- PostgreSQL driver (pg)
- Gemini SDK (@google/generative-ai)
- dotenv
- TypeScript + ts-node
- axios

### FILE 2: .env.example
```
DATABASE_URL=postgresql://user:password@[railway-app].railway.app/[db-name]
GEMINI_API_KEY=[placeholder]
SENDGRID_API_KEY=[placeholder]
ABR_API_ENDPOINT=https://data.business.gov.au/data/v1/abn/
PORT=3000
NODE_ENV=development
```

### FILE 3: .gitignore
node_modules/
.env
.DS_Store
dist/
build/
.env.local
*.log

### FILE 4: src/server.ts
Express server with:
- PostgreSQL connection pool
- /api/verify-document endpoint (stub for Phase 1B)
- /health endpoint
- Error handling
- CORS setup

### FILE 5: src/config/database.ts
PostgreSQL connection using Railway DATABASE_URL

### FILE 6: src/routes/api.ts
Route structure ready for Phase 1B/1C

## TERMINAL COMMANDS (3 total):
1. npm install
2. npm run build
3. npm run dev

## SUCCESS CRITERIA:
User runs commands and sees:
✅ "Server running on http://localhost:3000"
✅ "PostgreSQL connected"
✅ No errors

Then user says "Phase 1A complete" and you move to Phase 1B.
```

---

## Step-by-Step: What You Do

### STEP 1: Open Cursor on Mac
- Launch Cursor
- New chat with Claude

### STEP 2: Paste the Message Above
- Copy the entire message in the code block above
- Paste into Claude chat in Cursor
- Hit Enter

### STEP 3: Wait for Claude Response
Claude will provide:
- 6 files (package.json, .env.example, .gitignore, server.ts, database.ts, api.ts)
- 3 terminal commands to run

### STEP 4: Create Project Structure in Cursor Terminal
In Cursor terminal, run these commands IN ORDER:

```bash
# Command 1: Navigate and initialize
mkdir cis-platform
cd cis-platform
git init
```

### STEP 5: Create Files in Cursor
For each file Claude provides:
1. Create new file in Cursor editor
2. Paste Claude's content
3. Save with correct filename/path

File structure should look like:
```
cis-platform/
├── package.json
├── .env.example
├── .gitignore
├── tsconfig.json
└── src/
    ├── server.ts
    ├── config/
    │   └── database.ts
    └── routes/
        └── api.ts
```

### STEP 6: Run Terminal Commands
In Cursor terminal:

```bash
# Command 2: Install dependencies
npm install
```

Wait for completion (~2-3 minutes). You'll see:
```
added XXX packages
```

```bash
# Command 3: Start development server
npm run dev
```

You should see:
```
✅ Server running on http://localhost:3000
✅ PostgreSQL connected to Railway
```

### STEP 7: Tell Claude
In Cursor chat, say:
```
Phase 1A complete. I see the server running on http://localhost:3000. 
Ready for Phase 1B.
```

Claude proceeds to Phase 1B (Gemini Vision extraction pipeline).

---

## What If You Hit Errors?

### Error: "Node not found"
→ Download Node.js from https://nodejs.org/ (LTS)
→ Restart Cursor
→ Retry

### Error: "npm command not found"
→ Node.js not installed properly
→ Download LTS from https://nodejs.org/
→ Restart terminal and Cursor

### Error: "PostgreSQL connection failed"
→ Claude will provide Railway setup instructions
→ Follow them step-by-step

### Error: "Port 3000 already in use"
→ In Cursor terminal, press Ctrl+C to stop
→ Run: `lsof -i :3000` to find what's using it
→ Kill it or use different port

---

## Timeline

| Step | Time | Action |
|---|---|---|
| 1-2 | 2 min | Paste message to Claude, get response |
| 3-5 | 5 min | Create files in Cursor |
| 6a | 3 min | npm install (wait for dependencies) |
| 6b | 1 min | npm run dev (start server) |
| 7 | Immediate | Tell Claude "Phase 1A complete" |
| **Total** | **~15 min** | **Phase 1A Done** |

---

## Checkpoint: Before You Start

✅ Is Cursor installed on your Mac?
✅ Do you have GitHub account (Butterdime)?
✅ Do you have the message above ready to copy?
✅ Do you have this document open for reference?

If yes to all → You're ready. Start now.

---

## The Big Picture

What happens after Phase 1A:

**Week 1**:
- Phase 1B: Claude builds Gemini Vision extraction (Wed)
- Phase 1C: Claude builds ABR verification + mismatch detection (Thu)
- Phase 1D: Claude builds mismatch logic (Fri)

**Week 2**:
- Phase 1E: Database schema + audit logging (Mon)
- Phase 1F: Express API endpoints (Tue)
- Phase 2: Frontend integration with Vercel (Wed-Fri)

**Week 3**:
- Phase 3: Email notifications + manual review flow (Mon-Tue)
- Phase 4: Compliance validation + testing (Wed-Thu)
- **SHIP** (Friday)

---

## No More Decisions Needed From You

Just:
1. Copy message → Paste to Claude
2. Follow Claude's instructions
3. Run 3 terminal commands
4. Tell Claude "next phase"

That's it. The rest is automated via Claude + Cursor.

---

## Final Check

You have everything:
✅ 5 strategy docs in `/CIS-CLAUDE-BRIEF/`
✅ This execution guide
✅ Copy-paste message for Claude
✅ Terminal commands
✅ Error handling guide
✅ Timeline

**Ready to start. Copy the message above and paste into Claude in Cursor now.**
