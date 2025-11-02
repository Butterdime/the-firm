# 🚀 Quick Test Guide - Button Fix

## ⚡ 30-Second Test

1. Open: **http://localhost:3000/upload-cis.html**
2. Press **F12** (open console)
3. Upload any 4 PDF files
4. Button text should change to: **"✓ All documents uploaded. Click to extract data and verify."** (green)
5. Click the button
6. Console should show: **"▶️ Starting extraction and verification..."**

---

## 📋 What You Should See

### After Uploading Each File:
```
📊 Updating status for: [document-type]
   ✓ Updated UI for [document-type]
```

### After Uploading ALL 4 Files:
```
🔍 Validating uploads...
   All uploaded? true
🔘 Updating button state: ENABLED
```

### Helper Text Changes:
**Before:** "Please upload all 4 required AUSTRAC CDD documents to proceed" (gray)
**After:** "✓ All documents uploaded. Click to extract data and verify." (green/teal)

### When You Click Button:
```
🖱️ Button clicked: Extract Data & Verify
   Button disabled? false
▶️ Starting extraction and verification...
```

---

## ❌ If It Doesn't Work

### Check Console For:
1. Red error messages
2. `uploadState` showing all 4 documents
3. Button disabled status

### Try:
1. Hard refresh: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows)
2. Clear browser cache
3. Check Network tab for `document-validation.js` - should be 200 OK
4. Type in console: `uploadState` - should show all 4 as true/uploaded

---

## 📁 Required Documents (in order)

1. **Proof of Identity** - Section 1
2. **Proof of Residence** - Section 2
3. **Bank Statement** - Section 3
4. **ABN Statement** - Section 4

**Note:** For testing, you can use any PDF files. The system validates file types but not content.

---

## ✅ Success Criteria

- [ ] Console shows initialization message
- [ ] 4 green checkmarks appear after uploads
- [ ] Button text turns green
- [ ] Button responds to clicks
- [ ] "Starting extraction..." appears in console

---

## 🔧 Server Status

**URL:** http://localhost:3000/upload-cis.html
**Health Check:** http://localhost:3000/health
**Status:** ✅ Running

---

**Need more help?** See `TESTING_INSTRUCTIONS.md` for detailed guide.

