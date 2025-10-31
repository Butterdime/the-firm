# ✅ VERCEL ENVIRONMENT VARIABLES CHECKLIST

**Project**: RPR CIS SCAN v1  
**Repository**: Butterdime/the-firm  
**Date**: October 31, 2025  
**Purpose**: Final step to deploy RPR CIS SCAN v1 to production

---

## 🎯 OBJECTIVE

Configure 3 environment variables in Vercel Dashboard to enable:
- Database connectivity (Railway PostgreSQL)
- AI document processing (Gemini Vision API)
- Production mode settings

---

## 📋 PRE-CHECKLIST: VERIFY YOU HAVE

- [ ] Vercel account access
- [ ] Admin access to project "the-firm"
- [ ] Database URL from Railway (PostgreSQL)
- [ ] Gemini API key from Google AI Studio
- [ ] Web browser open

---

## 🔗 STEP 1: NAVIGATE TO VERCEL DASHBOARD

### Action:
1. Open your web browser
2. Navigate to: **https://vercel.com/Butterdime/the-firm/settings/environment-variables**
3. Verify you're on the correct project: **"the-firm"**
4. Verify you see the "Environment Variables" settings page

### Checklist:
- [ ] Vercel dashboard opened
- [ ] Project "the-firm" is selected
- [ ] "Environment Variables" tab is active
- [ ] You see "Add New" button

---

## 🔐 STEP 2: ADD DATABASE_URL

### Variable Details:
```
Name:        DATABASE_URL
Value:       postgresql://postgres:VZezhygqXhGYvBOurwFqsJHBVhtLgSwe@switchback.proxy.rlwy.net:32150/railway
Environment: Production
```

### Action Steps:
1. Click **"Add New"** button
2. In "Name" field, type: `DATABASE_URL`
3. In "Value" field, paste:
   ```
   postgresql://postgres:VZezhygqXhGYvBOurwFqsJHBVhtLgSwe@switchback.proxy.rlwy.net:32150/railway
   ```
4. Select environment: **"Production"** (check the box)
5. Click **"Save"**

### Verification Checklist:
- [ ] Variable name is exactly: `DATABASE_URL`
- [ ] Value starts with: `postgresql://`
- [ ] "Production" environment is checked
- [ ] Variable saved successfully (shows in list)

### ⚠️ Common Mistakes to Avoid:
- ❌ Extra spaces before/after the value
- ❌ Missing characters in the URL
- ❌ Wrong environment selected
- ❌ Typo in variable name (must be exact: `DATABASE_URL`)

---

## 🤖 STEP 3: ADD GEMINI_API_KEY

### Variable Details:
```
Name:        GEMINI_API_KEY
Value:       AIzaSyDrZXkgu3vF82mZwD0IKbYK9IL-asrHWj4
Environment: Production
```

### Action Steps:
1. Click **"Add New"** button again
2. In "Name" field, type: `GEMINI_API_KEY`
3. In "Value" field, paste:
   ```
   AIzaSyDrZXkgu3vF82mZwD0IKbYK9IL-asrHWj4
   ```
4. Select environment: **"Production"** (check the box)
5. Click **"Save"**

### Verification Checklist:
- [ ] Variable name is exactly: `GEMINI_API_KEY`
- [ ] Value starts with: `AIzaSy`
- [ ] "Production" environment is checked
- [ ] Variable saved successfully (shows in list)

### ⚠️ Common Mistakes to Avoid:
- ❌ Extra spaces or line breaks in API key
- ❌ Missing characters (API key is long ~40 chars)
- ❌ Wrong environment selected
- ❌ Typo in variable name (must be exact: `GEMINI_API_KEY`)

---

## 🚀 STEP 4: ADD NODE_ENV

### Variable Details:
```
Name:        NODE_ENV
Value:       production
Environment: Production
```

### Action Steps:
1. Click **"Add New"** button again
2. In "Name" field, type: `NODE_ENV`
3. In "Value" field, type: `production` (lowercase, no quotes)
4. Select environment: **"Production"** (check the box)
5. Click **"Save"**

### Verification Checklist:
- [ ] Variable name is exactly: `NODE_ENV`
- [ ] Value is exactly: `production` (lowercase)
- [ ] "Production" environment is checked
- [ ] Variable saved successfully (shows in list)

### ⚠️ Common Mistakes to Avoid:
- ❌ Capital "P" in production (must be lowercase)
- ❌ Extra quotes around "production"
- ❌ Wrong environment selected
- ❌ Typo in variable name (must be exact: `NODE_ENV`)

---

## ✅ STEP 5: VERIFY ALL VARIABLES ARE SET

### Final Verification:
After adding all 3 variables, you should see:

| Name | Value (masked) | Environment |
|------|----------------|-------------|
| `DATABASE_URL` | `postgresql://postgres:...` | Production |
| `GEMINI_API_KEY` | `AIzaSy...` | Production |
| `NODE_ENV` | `production` | Production |

### Verification Checklist:
- [ ] Exactly 3 environment variables visible
- [ ] All variables show "Production" environment
- [ ] No duplicate variables
- [ ] No typos in variable names
- [ ] Values are masked/hidden (security feature)

---

## 🔄 STEP 6: TRIGGER REDEPLOYMENT

### What Happens Automatically:
Vercel will **automatically redeploy** when you save environment variables.

### Monitor Deployment:
1. Navigate to: **https://vercel.com/Butterdime/the-firm**
2. Look for "Deployments" tab
3. You should see a new deployment in progress

### Deployment Checklist:
- [ ] New deployment shows in dashboard
- [ ] Status changes from "Building" → "Ready"
- [ ] Deployment completes successfully (green checkmark)
- [ ] Production URL updates: https://the-firm.vercel.app

### ⏱️ Expected Time:
- **Build time**: ~1-2 minutes
- **Total time**: ~2-3 minutes

---

## 🧪 STEP 7: TEST PRODUCTION DEPLOYMENT

### Option A: Run Verification Script (Recommended)
```bash
cd /Users/puvansivanasan/Documents/CURSOR/the-firm
./DEPLOYMENT_VERIFICATION.sh
```

### Option B: Manual Testing
Test these URLs in your browser:

#### Test 1: Health Check
```bash
curl https://the-firm.vercel.app/health
```
**Expected Response:**
```json
{"status":"ok","timestamp":"2025-10-31T..."}
```
- [ ] Health endpoint responds
- [ ] Status is "ok"

#### Test 2: Frontend UI
Open in browser: **https://the-firm.vercel.app/**
- [ ] Page loads successfully
- [ ] Document upload interface visible
- [ ] No 404 or error pages

#### Test 3: Analytics Dashboard
Open in browser: **https://the-firm.vercel.app/dashboard.html**
- [ ] Dashboard loads successfully
- [ ] Statistics cards visible
- [ ] No 404 or error pages

#### Test 4: API Endpoint
```bash
curl -s https://the-firm.vercel.app/api/analytics/summary
```
**Expected**: JSON response with verification statistics
- [ ] API responds with JSON
- [ ] No error messages

---

## 🎉 STEP 8: CONFIRM PRODUCTION READY

### Final Production Checklist:
- [ ] All 3 environment variables set in Vercel
- [ ] Vercel deployment completed successfully
- [ ] Health endpoint returns {"status":"ok"}
- [ ] Frontend UI accessible
- [ ] Analytics dashboard accessible
- [ ] API endpoints responding correctly
- [ ] No 404 errors on main pages

---

## 📸 SCREENSHOT CHECKLIST (OPTIONAL)

For documentation/verification purposes:
- [ ] Screenshot of Vercel environment variables page (showing 3 variables)
- [ ] Screenshot of successful deployment
- [ ] Screenshot of frontend UI loaded
- [ ] Screenshot of analytics dashboard

---

## 🆘 TROUBLESHOOTING

### Issue: Variables Not Saving
**Solution:**
- Check you have admin access to the project
- Try refreshing the page
- Try logging out and back in to Vercel

### Issue: Deployment Failed
**Solution:**
1. Check deployment logs in Vercel dashboard
2. Look for error messages
3. Verify environment variable values are correct
4. Check for typos in variable names

### Issue: 404 Errors After Deployment
**Solution:**
1. Wait 2-3 minutes for DNS propagation
2. Clear browser cache
3. Try incognito/private browsing mode
4. Check Vercel deployment logs

### Issue: Health Endpoint Returns Error
**Solution:**
1. Verify DATABASE_URL is correct
2. Check Railway database is running
3. Review Vercel function logs
4. Ensure all 3 variables are set

---

## 📞 SUPPORT RESOURCES

### Vercel Documentation:
- Environment Variables: https://vercel.com/docs/concepts/projects/environment-variables
- Deployments: https://vercel.com/docs/deployments/overview

### Project Documentation:
- README.md - Full API documentation
- TEST_GUIDE.md - Testing procedures
- DEPLOYMENT_VERIFICATION.sh - Automated testing script

---

## ✅ COMPLETION CONFIRMATION

**Date Completed**: _______________  
**Completed By**: _______________  
**Deployment URL**: https://the-firm.vercel.app

### Sign-off Checklist:
- [ ] All environment variables configured
- [ ] Deployment successful
- [ ] Production testing passed
- [ ] Application accessible to users
- [ ] RPR CIS SCAN v1 is LIVE! 🎉

---

## 🚀 NEXT STEPS AFTER DEPLOYMENT

1. **Upload Real Documents**: Test with actual Australian business documents
2. **Verify ABN Lookups**: Confirm ABR API integration works
3. **Test Manual Review**: Upload documents that require review
4. **Monitor Analytics**: Check dashboard for verification statistics
5. **User Testing**: Have Australian accountants test the platform
6. **Collect Feedback**: Iterate based on real-world usage

---

**REMINDER**: This is the FINAL step to make RPR CIS SCAN v1 live!

**Once these 3 variables are set, the application will be fully operational and ready to serve Australian SMB accountants with automated, compliant document verification.** 🎉

---

**Questions?** Review the README.md or run ./DEPLOYMENT_VERIFICATION.sh after setup.

