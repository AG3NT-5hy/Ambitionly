# 🚀 Deployment Guide

## Quick Deploy to Railway (Recommended)

### Option 1: Deploy from GitHub

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Connect to Railway:**
   - Go to https://railway.app
   - Sign up with GitHub
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway will auto-detect and start building

3. **Add Environment Variables:**
   - Go to your project settings
   - Add these variables:
     ```
     DATABASE_URL=your_supabase_connection_string
     PORT=3000
     NODE_ENV=production
     ```

4. **Get your public URL:**
   - Railway will provide: `https://your-app.railway.app`
   - This is your backend URL!

5. **Update RevenueCat Webhook:**
   - Go to RevenueCat Dashboard
   - Add webhook URL: `https://your-app.railway.app/trpc/webhooks.revenuecat`

### Option 2: Deploy via Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize
railway init

# Deploy
railway up
```

---

## Alternative: Deploy to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Configure:**
   - Add `DATABASE_URL` in Vercel dashboard
   - Get your URL: `https://your-app.vercel.app`

---

## 📋 After Deployment Checklist

- [ ] Backend deployed and accessible
- [ ] Environment variables set (DATABASE_URL, etc.)
- [ ] Test health endpoint: `https://your-app.railway.app`
- [ ] Update RevenueCat webhook URL
- [ ] Update app to use new backend URL
- [ ] Test webhook with a test purchase

---

## 🔗 Important URLs

- **Backend Health Check:** `https://your-app.railway.app/`
- **tRPC Endpoint:** `https://your-app.railway.app/api/trpc`
- **Email API:** `https://your-app.railway.app/api/emails`
- **RevenueCat Webhook:** `https://your-app.railway.app/api/trpc/webhooks.revenuecat`

---

## Testing Your Deployment

```bash
# Test health endpoint
curl https://your-app.railway.app/

# Expected response:
# {"status":"ok","message":"API is running"}
```

