# Getting Everything into Claude Mac + Cursor Workflow

## Summary: What You're Doing

1. **Path A Confirmed**: Using public ABN Lookup API (free, no credentials)
2. **You**: Share 5 documents with Claude
3. **Claude**: Executes implementation via Cursor on Mac

---

## The 5 Documents Claude Needs

All in `/Users/puvansivanasan/Documents/APP BUILDING/PERPLEXITY WORKSPACE/CIS-PLATFORM-BRIEF/`:

1. **claude-job-brief.md** — Technical mandate (CRITICAL)
2. **final-objectives.md** — Business context
3. **handoff-strategy.md** — Collaboration model
4. **rollout-direction.md** — Implementation roadmap + phases
5. **abr-api-setup.md** — Path A decision confirmed (no credentials needed)

---

## Step 1: Copy All 5 Documents

### Option A: Copy-Paste Method (Fastest)
1. Open each `.md` file in your text editor
2. Copy entire content of each file
3. Create a new message to Claude in Claude Mac
4. Paste all 5 documents (or paste each in separate messages)

### Option B: Share as Text (Best for Clarity)
Format each document as a code block:

```markdown
# Document 1: claude-job-brief.md
[paste full content here]

# Document 2: final-objectives.md
[paste full content here]

# Document 3: handoff-strategy.md
[paste full content here]

# Document 4: rollout-direction.md
[paste full content here]

# Document 5: abr-api-setup.md
[paste full content here - include the "Path A: Use Public ABN Lookup API" section]
```

### Option C: Use Claude's File Upload (If Available)
If Claude Mac supports file uploads:
1. Drag each `.md` file into the Claude chat
2. Claude will read and reference them

---

## Step 2: Send the Startup Prompt to Claude

Once you've shared the 5 documents, send Claude this exact prompt:

---

### COPY THIS ENTIRE PROMPT FOR CLAUDE:

```
## CIS Platform Implementation Brief - Path A (Public ABN API)

I'm handing you 5 documents that define a complete product build for a document verification platform targeting Australian SMB accountants.

**Your Job**: Execute the rollout using Cursor on this Mac.

**Your Constraint**: Mismatched verification can NEVER occur.

**Your Path**: Path A (Public ABN Lookup API - no credentials needed, implementation starts immediately).

---

### DOCUMENTS PROVIDED:
1. claude-job-brief.md - Your technical mandate
2. final-objectives.md - Business context + market
3. handoff-strategy.md - How you and the human collaborate
4. rollout-direction.md - 4-phase implementation roadmap with AI agent allocation
5. abr-api-setup.md - Confirmed you're using public ABN API

---

### YOUR FIRST RESPONSE SHOULD INCLUDE:

1. **Confirmation**: "I understand the constraint: mismatched verification can NEVER occur"
2. **Path A Clarification**: 
   - Confirm you're using: https://data.business.gov.au/data/v1/abn/
   - No API key needed
   - Public endpoint, rate limits standard
3. **Cursor Agent Allocation** (how you'll divide work across Cursor agents):
   - Which agents handle Phase 1A, 1B, 1C, 1D, 1E, 1F?
   - Any adjustments to my recommendations?
4. **Timeline Estimate**:
   - Phase 1 (Backend): How many hours?
   - Phase 2 (Frontend): How many hours?
   - Total weeks to launch?
5. **Blocking Questions** (if any):
   - Do you have access to the GitHub repo?
   - Do you have Railway login info?
   - Any other blockers before starting?
6. **Early Test Suite Outline**:
   - The 8 mismatch scenarios you'll test
   - Sample ABNs you'll use

---

### THEN PROCEED TO PHASE 1A:

Once confirmed, start Phase 1A (Project Setup):
- Initialize Node.js + Express on Railway template
- Set up environment variables (GEMINI_API_KEY, DATABASE_URL, SENDGRID_API_KEY)
- Create `/api` routes structure
- Initialize PostgreSQL schema
- Deliverable: Repo ready with `npm run dev` working locally

---

### SUCCESS DEFINITION FOR THIS PHASE:

✅ I can clone your repo locally
✅ I can run `npm run dev`
✅ PostgreSQL connects successfully
✅ Environment variables are correctly configured
✅ Rails backend structure is ready for Phase 1B

---

### YOUR COMMUNICATION WITH ME (the human):

Keep me updated via this chat. After Phase 1A, wait for my sign-off before moving to Phase 1B.

I'm ready. What's your first response?
```

---

## Step 3: Wait for Claude's Response

Claude will respond with:
1. Confirmation of constraints
2. Agent allocation
3. Questions about setup
4. Timeline estimate

**What you do**: Answer any blocking questions Claude asks.

---

## Step 4: Claude Starts Phase 1A (Local Setup)

Claude uses Cursor to:
1. Clone/init repo
2. Set up Express on Railway
3. Initialize PostgreSQL
4. Create environment config

**What you do**: Watch Cursor for output, provide feedback

---

## Step 5: You Review Phase 1A Deliverables

Once Claude says "Phase 1A complete", Claude will provide:
- Link to GitHub repo
- Instructions to run locally
- PostgreSQL schema SQL
- Environment template

**What you do**: 
1. Clone repo
2. Run `npm run dev`
3. Verify it works
4. Tell Claude "Phase 1A approved" or "needs fix: [issue]"

---

## Important: Cursor Commands for Claude

Claude should use these Cursor commands on Mac:

### Command 1: Create Project Structure
```bash
# In Cursor terminal
mkdir cis-platform
cd cis-platform
npm init -y
npm install express dotenv pg axios
touch .env .gitignore
```

### Command 2: Create Environment Template
```bash
# Create .env file
cat > .env << 'EOF'
DATABASE_URL=postgresql://user:password@localhost:5432/cis_db
GEMINI_API_KEY=your-key-here
SENDGRID_API_KEY=your-key-here
ABR_API_ENDPOINT=https://data.business.gov.au/data/v1/abn/
NODE_ENV=development
PORT=3000
EOF
```

### Command 3: Initialize Git
```bash
git init
git config user.email "your-email@example.com"
git config user.name "Your Name"
git add .
git commit -m "Initial commit: project setup"
git remote add origin https://github.com/Butterdime/cis-platform.git
git push -u origin main
```

### Command 4: Start Local Dev
```bash
npm run dev
# Should output: Server running on http://localhost:3000
```

---

## What to Tell Claude About Your Local Setup

Before Claude starts, tell Claude:

```
Here's my local Mac setup:
- Node.js version: [check with: node -v]
- npm version: [check with: npm -v]
- PostgreSQL: [installed locally or using Railway?]
- GitHub account: Butterdime
- Cursor version: [latest]
- Any proxies/VPN: [yes/no]
```

If you don't have PostgreSQL locally, Claude should use Railway's PostgreSQL instead.

---

## Timeline for This Session

| Time | Action |
|---|---|
| Now | You share 5 documents + startup prompt with Claude |
| +15 min | Claude confirms understanding + asks clarifying questions |
| +30 min | You answer Claude's questions |
| +1-2 hours | Claude executes Phase 1A (project setup) in Cursor |
| +2-3 hours | You review Phase 1A deliverables |
| Next session | Claude proceeds to Phase 1B (Gemini extraction) |

---

## Copy-Paste Ready: Send This to Claude Right Now

You have two options:

### Option 1: Share the 5 Documents First
1. Copy each of the 5 `.md` files
2. Send to Claude as separate messages (or one big message)
3. Then send the "COPY THIS ENTIRE PROMPT FOR CLAUDE" above

### Option 2: Send Everything at Once
Combine all 5 documents + the startup prompt into one message to Claude.

---

## Checkpoint: Before You Send

✅ Have all 5 documents ready to copy?
✅ Have you saved the startup prompt above?
✅ Do you have Cursor open on Mac?
✅ Do you have your GitHub login ready (Butterdime)?
✅ Have you confirmed your local Node.js/npm setup?

If yes to all, you're ready to send everything to Claude.

---

## After You Send: What Happens

Claude will:
1. Read the 5 documents
2. Understand the constraint (mismatched verification = never)
3. Confirm Path A (public API)
4. Ask clarifying questions
5. Start Phase 1A when approved

You will:
1. Answer Claude's questions
2. Review Claude's work
3. Provide feedback
4. Approve each phase before next

---

## Key: Keep Communication Clear

**What Claude needs from you**:
- Clear yes/no answers to questions
- Local setup details (Node version, PostgreSQL setup, etc.)
- GitHub/Railway credentials/links
- Approval/rejection of each phase

**What you'll get from Claude**:
- Working code you can `npm run dev`
- Clear error messages if issues arise
- Timeline updates
- Test results

---

## You're Ready. Next Step:

1. Gather the 5 documents
2. Copy the startup prompt above
3. Send to Claude in Claude Mac
4. Wait for Claude's first response

Go! 🚀
