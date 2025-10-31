#!/bin/bash
# RPR CIS SCAN v2 - Deployment Commands
# Run these commands to deploy

echo "🚀 RPR CIS SCAN v2 - Deployment Script"
echo "========================================"
echo ""

# Step 1: Verify build
echo "Step 1: Verifying build..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed. Fix errors before deploying."
    exit 1
fi
echo "✅ Build successful"
echo ""

# Step 2: Show what will be committed
echo "Step 2: Files to be committed:"
git status --short
echo ""

# Step 3: Commit
echo "Step 3: Committing changes..."
git add .
git commit -m "feat: Add v2 KYC verification system

- Implement 3-point KYC verification (Identity → Residence → Bank)
- Add ABR entity discovery integration  
- Add bank verification with 100-point confidence scoring
- Add CDD report generation
- Add manual review queue system
- Fix: entity_match_method empty string → NULL
- Fix: search_postcode empty string → actual postcode
- Preserve all v1 functionality (zero breaking changes)"

if [ $? -ne 0 ]; then
    echo "❌ Commit failed"
    exit 1
fi
echo "✅ Changes committed"
echo ""

# Step 4: Push
echo "Step 4: Pushing to GitHub (triggers Vercel auto-deploy)..."
read -p "Push to origin/main? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin main
    if [ $? -eq 0 ]; then
        echo "✅ Pushed to GitHub"
        echo ""
        echo "📋 Next Steps:"
        echo "1. Run database migration: psql \"\$DATABASE_URL\" < migrations/002_kyc_tables.sql"
        echo "2. Configure Vercel environment variables"
        echo "3. Monitor Vercel deployment at: https://vercel.com"
    else
        echo "❌ Push failed"
        exit 1
    fi
else
    echo "⚠️  Push cancelled. Run 'git push origin main' manually when ready."
fi

echo ""
echo "✅ Deployment script complete!"

