# Deployment Scripts

Automated scripts for deploying and verifying the CIS Platform.

## Scripts

### `setup-database.sh`

Sets up the PostgreSQL database with required schema.

**Usage**:
```bash
export DATABASE_URL="postgresql://user:pass@host:port/database"
./scripts/setup-database.sh
```

**What it does**:
- Tests database connection
- Checks for existing tables
- Runs migration (001_schema.sql)
- Verifies all tables created successfully
- Shows record counts

**Requirements**:
- `psql` command-line tool installed
- DATABASE_URL environment variable set
- migrations/001_schema.sql file exists

---

### `deploy-verify.sh`

Comprehensive verification of deployment status.

**Usage**:
```bash
export DATABASE_URL="postgresql://user:pass@host:port/database"
./scripts/deploy-verify.sh
```

**What it tests**:
- API health endpoint
- Root API endpoint
- Database connection
- All 3 tables exist (documents, verifications, audit_logs)
- Vercel environment variables (if vercel CLI installed)
- Database statistics

**Exit codes**:
- `0` - All tests passed
- `1` - One or more tests failed

**Requirements**:
- DATABASE_URL environment variable set (for database tests)
- `vercel` CLI installed (optional, for env var checks)
- Internet connection (for API endpoint tests)

---

## Quick Start

**For Cursor AI / Copilot**:

```bash
# 1. Setup database
export DATABASE_URL="postgresql://user:pass@host:port/db"
./scripts/setup-database.sh

# 2. Verify deployment
./scripts/deploy-verify.sh
```

**For manual deployment**:

```bash
# See AI_ASSISTANT_DEPLOYMENT_GUIDE.md for complete instructions
```

---

## Troubleshooting

### Error: "psql: command not found"

**Solution**:
```bash
# Mac
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Windows
# Download from https://www.postgresql.org/download/windows/
```

### Error: "DATABASE_URL environment variable is not set"

**Solution**:
```bash
export DATABASE_URL="postgresql://user:pass@host:port/database?sslmode=require"
```

### Error: "Could not connect to database"

**Possible causes**:
1. Database server is not accessible
2. Incorrect credentials
3. SSL mode not configured
4. Firewall blocking connection

**Solution**:
```bash
# Test connection manually
psql "$DATABASE_URL" -c "SELECT version();"

# Check SSL mode is included
echo $DATABASE_URL | grep "sslmode"

# Verify credentials with database provider
```

---

## For AI Assistants

These scripts are designed to be run by AI coding assistants (Cursor, Copilot) to automate deployment.

**See**: `AI_ASSISTANT_DEPLOYMENT_GUIDE.md` for complete step-by-step instructions.

**Key points**:
- Scripts provide colored output for easy reading
- Exit codes indicate success/failure
- All prerequisites are checked before running
- Clear error messages with solutions provided
- Safe to run multiple times (idempotent where possible)
