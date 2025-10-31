# GitHub Copilot Instructions: Complete RPR CIS SCAN v1 Database Setup

**Date**: October 31, 2025
**Project**: RPR CIS SCAN v1
**Current Status**: Dependencies installed, .env partially configured
**Next Step**: Update DATABASE_URL and run migration

---

## 🎯 OBJECTIVE

Complete the database setup by:
1. Getting the correct DATABASE_URL from Railway
2. Updating the .env file
3. Running the database migration
4. Starting the development server
5. Testing the API endpoints

---

## 📋 PREREQUISITES (ALREADY COMPLETE)

✅ Node.js v24.10.0 installed  
✅ npm dependencies installed (605 packages)  
✅ TypeScript compiled successfully  
✅ .env file created  
✅ GEMINI_API_KEY configured  
✅ Railway CLI installed and logged in  
✅ Railway project "RPR CIS SCAN" exists  

---

## ⚠️ CURRENT PROBLEM

The `.env` file has an **invalid DATABASE_URL**:

```bash
# Current (WRONG):
DATABASE_URL=d2a6aa2e-2646-4d24-9893-a95f10393e27
```

This is just a UUID, not a PostgreSQL connection string.

**It needs to be replaced with the full connection string from Railway.**

---

## 🔐 CENTRALIZED CREDENTIALS & AUTOMATION (RECOMMENDED)

### Master Credentials Setup

For easier credential management across all projects, you can use the centralized credentials system:

**Location**: `/Users/puvansivanasan/Documents/APP BUILDING/PERPLEXITY WORKSPACE/PERPLEXITY_COMMAND_SPACE/COPILOT_CREDENTIALS_SETUP.md`

This file contains:
- **Master credentials template** for all services (GitHub, Vercel, Railway, Google Cloud, etc.)
- **Shell automation** to auto-export credentials
- **Copilot setup instructions** for automated credential loading
- **Security best practices** for file permissions

### Quick Setup (Alternative to Manual Entry)

If you have the master credentials file set up:

```bash
# Add to your shell profile (~/.zshrc or ~/.bashrc)
if [ -f ~/.env.master ]; then
  export $(cat ~/.env.master | grep -v '^#' | xargs)
fi

# Reload shell
source ~/.zshrc  # or source ~/.bashrc

# Verify credentials loaded
echo $DATABASE_URL
```

This automatically exports all credentials to your environment, making them available to all projects.

---

## 🔧 TASK 1: GET DATABASE_URL FROM RAILWAY

### Method 1: Railway Dashboard (Recommended)

1. **Open Railway Dashboard**
   - Go to: https://railway.app
   - Login as: butterdime@gmail.com

2. **Select Project**
   - Click on project: **"RPR CIS SCAN"**

3. **Open PostgreSQL Service**
   - Click on the **PostgreSQL** service card

4. **Get DATABASE_URL**
   - Click on **"Variables"** tab
   - Find variable: `DATABASE_URL`
   - Click the **eye icon** to reveal the value
   - **Copy the entire connection string**

5. **Expected Format**
   ```bash
   postgresql://postgres:LONG_PASSWORD_HERE@switchback.proxy.rlwy.net:32150/railway
   ```
   
   Components:
   - Protocol: `postgresql://`
   - Username: `postgres`
   - Password: Long random string (keep secret!)
   - Host: `switchback.proxy.rlwy.net`
   - Port: `32150`
   - Database: `railway`

### Method 2: Railway CLI (Alternative)

If you have terminal access:

```bash
# Navigate to project directory
cd /Users/puvansivanasan/Documents/CURSOR/the-firm

# Link Railway project (interactive - select "RPR CIS SCAN")
railway link

# Get all environment variables
railway variables

# Look for DATABASE_URL in the output
```

---

## 🔧 TASK 2: UPDATE .env FILE

### Current File Location
```
/Users/puvansivanasan/Documents/CURSOR/the-firm/.env
```

### Option A: Use Centralized Credentials (Automated)

If you've set up the master credentials file:

```bash
# Navigate to project
cd /Users/puvansivanasan/Documents/CURSOR/the-firm

# Source master credentials (if not auto-loaded)
source ~/.env.master

# Auto-update .env with correct DATABASE_URL from environment
cat > .env << EOF
# CIS Platform Environment Variables

# Database (from master credentials)
DATABASE_URL=$DATABASE_URL

# Gemini Vision API (2.5 Flash)
GEMINI_API_KEY=$GEMINI_API_KEY

# Server
PORT=3000
NODE_ENV=development

# ABN Lookup API (Public - No GUID needed)
ABN_API_ENDPOINT=https://abr.business.gov.au/json/AbnDetails.aspx
EOF

echo "✓ .env updated with centralized credentials"
```

### Option B: Manual Update (if no master credentials)

**BEFORE** (line 4):
```bash
DATABASE_URL=d2a6aa2e-2646-4d24-9893-a95f10393e27
```

**AFTER** (replace with actual Railway URL):
```bash
DATABASE_URL=postgresql://postgres:YOUR_ACTUAL_PASSWORD@switchback.proxy.rlwy.net:32150/railway
```

### Command to Update Manually

```bash
# Navigate to project
cd /Users/puvansivanasan/Documents/CURSOR/the-firm

# Backup current .env
cp .env .env.backup

# Edit .env file
nano .env
# OR
code .env
# OR
vim .env

# Replace the DATABASE_URL line with the actual Railway connection string
# Save and exit
```

### Verify the Change

```bash
# Check the DATABASE_URL (should start with postgresql://)
grep DATABASE_URL .env

# Should output something like:
# DATABASE_URL=postgresql://postgres:long_password@switchback.proxy.rlwy.net:32150/railway
```

---

## 🔧 TASK 3: RUN DATABASE MIGRATION

Once the DATABASE_URL is correctly configured:

### Command

```bash
cd /Users/puvansivanasan/Documents/CURSOR/the-firm

# Run migration using psql
psql "$DATABASE_URL" < migrations/001_schema.sql
```

### Expected Output

```
CREATE TABLE
CREATE TABLE
CREATE TABLE
```

This creates three tables:
1. `documents` - Stores uploaded files
2. `verifications` - Stores trilogy verification results
3. `audit_logs` - Complete audit trail

### Verify Tables Created

```bash
# List all tables
psql "$DATABASE_URL" -c "\dt"

# Expected output:
#  Schema | Name          | Type  | Owner
# --------+---------------+-------+-------
#  public | documents     | table | postgres
#  public | verifications | table | postgres
#  public | audit_logs    | table | postgres
```

### Check Table Schemas

```bash
# Describe documents table
psql "$DATABASE_URL" -c "\d documents"

# Describe verifications table
psql "$DATABASE_URL" -c "\d verifications"

# Describe audit_logs table
psql "$DATABASE_URL" -c "\d audit_logs"
```

---

## 🔧 TASK 4: START DEVELOPMENT SERVER

### Command

```bash
cd /Users/puvansivanasan/Documents/CURSOR/the-firm

# Start server with hot reload
npm run dev
```

### Expected Output

```
> cis-platform@1.0.0 dev
> tsx watch src/server.ts

Server running on http://localhost:3000
Database connected successfully
```

### If It Fails

**Error: "Database connection failed"**
- Verify DATABASE_URL is correct in .env
- Check database is accessible: `psql "$DATABASE_URL" -c "SELECT 1"`

**Error: "Port 3000 already in use"**
```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process or use different port
PORT=3001 npm run dev
```

**Error: "Cannot find module"**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## 🔧 TASK 5: TEST API ENDPOINTS

### Test 1: Health Check

```bash
# In a new terminal window
curl http://localhost:3000/api/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-10-31T...",
  "database": "connected",
  "gemini_api": "configured"
}
```

### Test 2: Database Connection

```bash
# Test database query
curl http://localhost:3000/api/verifications

# Should return empty array (no verifications yet):
[]
```

### Test 3: Document Upload (Requires PDF file)

```bash
# Upload a test document
curl -X POST http://localhost:3000/api/verify-document \
  -F "document=@/path/to/test-invoice.pdf" \
  -F "document_date=2025-10-30"

# Expected: JSON response with verification results
```

---

## 📊 SUCCESS CRITERIA

You'll know everything is working when:

1. ✅ `.env` has valid DATABASE_URL starting with `postgresql://`
2. ✅ Migration runs without errors
3. ✅ Three tables exist in database (documents, verifications, audit_logs)
4. ✅ Server starts on http://localhost:3000
5. ✅ Health endpoint responds with `{"status":"ok"}`
6. ✅ No database connection errors in logs

---

## 🐛 TROUBLESHOOTING

### Issue: "FATAL: password authentication failed"

**Solution**: DATABASE_URL password is incorrect
```bash
# Get fresh DATABASE_URL from Railway
railway variables | grep DATABASE_URL

# Update .env with new URL
```

### Issue: "relation 'documents' does not exist"

**Solution**: Migration didn't run
```bash
# Run migration again
psql "$DATABASE_URL" < migrations/001_schema.sql

# Verify tables
psql "$DATABASE_URL" -c "\dt"
```

### Issue: "connection timeout"

**Solution**: Railway database might be sleeping
```bash
# Wake up database
psql "$DATABASE_URL" -c "SELECT 1"

# Try starting server again
npm run dev
```

### Issue: "SSL required"

**Solution**: Add sslmode to DATABASE_URL
```bash
# In .env, ensure URL ends with:
DATABASE_URL=postgresql://...?sslmode=require
```

---

## 📝 COMPLETE EXECUTION CHECKLIST

Copy this checklist and mark items as complete:

```
[ ] 1. Open Railway dashboard (https://railway.app)
[ ] 2. Navigate to "RPR CIS SCAN" project
[ ] 3. Click PostgreSQL service
[ ] 4. Go to Variables tab
[ ] 5. Copy DATABASE_URL value
[ ] 6. Open .env file in editor
[ ] 7. Replace DATABASE_URL with copied value
[ ] 8. Save .env file
[ ] 9. Verify DATABASE_URL format (starts with postgresql://)
[ ] 10. Run migration: psql "$DATABASE_URL" < migrations/001_schema.sql
[ ] 11. Verify tables created: psql "$DATABASE_URL" -c "\dt"
[ ] 12. Start server: npm run dev
[ ] 13. Test health endpoint: curl http://localhost:3000/api/health
[ ] 14. Verify server logs show no errors
[ ] 15. Test database query: curl http://localhost:3000/api/verifications
```

---

## 🎉 FINAL STEP

Once all tasks complete successfully:

**Update SETUP_COMPLETE.md** status:

```markdown
## Current Project Status

| Component | Status | Notes |
|-----------|--------|-------|
| Node.js | ✅ Installed | v24.10.0 |
| Dependencies | ✅ Installed | 605 packages |
| TypeScript Build | ✅ Compiled | No errors |
| .env File | ✅ Configured | All variables set |
| Database | ✅ Connected | Tables created |
| Gemini API | ✅ Configured | Key valid |
| Server | ✅ Running | http://localhost:3000 |
```

---

## 🔐 SECURITY REMINDERS

1. **Never commit .env file** to git (already in .gitignore)
2. **Keep DATABASE_URL secret** - it contains password
3. **Don't share connection string** in public channels
4. **Rotate credentials** if accidentally exposed

---

## 📚 REFERENCE DOCUMENTATION

After setup is complete, see:
- **API Documentation**: `README.md`
- **Testing Guide**: `TEST_GUIDE.md` (8 edge case scenarios)
- **Deployment Guide**: `VERCEL_DEPLOYMENT_GUIDE.md`
- **Audit Report**: `AUDIT_REPORT.md` (security verification)

---

## 🆘 NEED HELP?

If you encounter issues:

1. Check logs: `tail -f /tmp/npm-debug.log`
2. Test database: `psql "$DATABASE_URL" -c "SELECT version()"`
3. Verify environment: `node -e "console.log(process.env.DATABASE_URL)"`
4. Review this document for troubleshooting steps

---

**Status**: Ready for execution once DATABASE_URL is obtained from Railway.

**Estimated Time**: 5-10 minutes once you have the DATABASE_URL.

---

## 🤖 COPILOT AUTOMATION INTEGRATION

### Universal Credentials Access

This project can integrate with the centralized credentials system for automated setup:

**Reference**: `/Users/puvansivanasan/Documents/APP BUILDING/PERPLEXITY WORKSPACE/PERPLEXITY_COMMAND_SPACE/COPILOT_CREDENTIALS_SETUP.md`

### Benefits of Centralized Credentials

1. **Single Source of Truth**: All credentials stored in one master file
2. **Auto-Export**: Credentials automatically available in all terminal sessions
3. **Version Control Safe**: Master file excluded from git (listed in .gitignore)
4. **Easy Updates**: Change once, applies to all projects
5. **Copilot Compatible**: Can be read and used by GitHub Copilot/Cursor

### Setup for This Project

```bash
# 1. Ensure master credentials file exists
test -f ~/.env.master && echo "✓ Master credentials found" || echo "✗ Create ~/.env.master"

# 2. Add this project's required credentials to ~/.env.master
cat >> ~/.env.master << 'EOF'

# CIS Platform / RPR CIS SCAN
DATABASE_URL=postgresql://postgres:PASSWORD@switchback.proxy.rlwy.net:32150/railway
GEMINI_API_KEY=AIzaSyDrZXkgu3vF82mZwD0IKbYK9IL-asrHWj4
EOF

# 3. Set secure permissions
chmod 600 ~/.env.master

# 4. Add to shell profile (if not already present)
grep -q "env.master" ~/.zshrc || cat >> ~/.zshrc << 'EOF'

# Auto-load centralized credentials
if [ -f ~/.env.master ]; then
  export $(cat ~/.env.master | grep -v '^#' | xargs)
fi
EOF

# 5. Reload shell
source ~/.zshrc

# 6. Verify credentials loaded
echo "DATABASE_URL: ${DATABASE_URL:0:30}..." # Shows first 30 chars
echo "GEMINI_API_KEY: ${GEMINI_API_KEY:0:20}..." # Shows first 20 chars
```

### Copilot/Cursor Instructions

For GitHub Copilot or Cursor to use centralized credentials:

```bash
# Copilot can execute this to auto-configure the project
cd /Users/puvansivanasan/Documents/CURSOR/the-firm

# Load master credentials
source ~/.env.master

# Generate .env from master credentials
cat > .env << EOF
# CIS Platform Environment Variables
# Auto-generated from master credentials

DATABASE_URL=$DATABASE_URL
GEMINI_API_KEY=$GEMINI_API_KEY
PORT=3000
NODE_ENV=development
ABN_API_ENDPOINT=https://abr.business.gov.au/json/AbnDetails.aspx
EOF

# Run migration
psql "$DATABASE_URL" < migrations/001_schema.sql

# Start server
npm run dev
```

### Security Best Practices

1. **Never commit ~/.env.master** to version control
2. **Set restrictive permissions**: `chmod 600 ~/.env.master`
3. **Backup securely**: Keep encrypted backup of master credentials
4. **Rotate regularly**: Update passwords every 90 days
5. **Use environment-specific values**: Different credentials for dev/staging/prod

### Integration with Perplexity Workspace

The master credentials file integrates with:
- **Perplexity Command Space**: For AI-assisted credential management
- **Bridge System**: For cross-project credential sharing
- **Copilot Automation**: For automated project setup
- **Cursor Integration**: For seamless development workflow

---

**Last Updated**: October 31, 2025  
**With**: Perplexity centralized credentials integration

