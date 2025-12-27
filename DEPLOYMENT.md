# Deployment Guide - Free Platforms

This guide explains how to deploy GluCover to free platforms with both preview and production environments.

## Architecture Overview

- **Frontend**: Vercel (free tier)
- **Backend**: Render, Railway, or Fly.io (free tier)
- **Database**: Neon, Supabase, or Render PostgreSQL (free tier)

## Option 1: Vercel (Frontend) + Render (Backend + Database)

### Step 1: Deploy Database on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "PostgreSQL"
3. Configure:
   - Name: `glucover-db`
   - Region: Choose closest to your users
   - Plan: **Free**
4. Click "Create Database"
5. Copy the **External Database URL** for later use

### Step 2: Deploy Backend on Render

1. In Render Dashboard, click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - Name: `glucover-api`
   - Runtime: **Node**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Plan: **Free**
4. Add environment variables:
   - `NODE_ENV` = `production`
   - `PORT` = `5000`
   - `DATABASE_URL` = [paste the External Database URL from Step 1]
   - `SESSION_SECRET` = [generate a secure random string]
   - `SESSION_COOKIE_SECURE` = `true`
   - `OPENAI_API_KEY` = [your OpenAI API key] (optional)
   - `ALLOWED_ORIGINS` = [will be filled after frontend deployment]
5. Click "Create Web Service"
6. Wait for deployment to complete
7. Copy your backend URL (e.g., `https://glucover-api.onrender.com`)

### Step 3: Run Database Migrations

1. In Render Dashboard, open your `glucover-api` service
2. Go to "Shell" tab
3. Run: `npm run db:push`

### Step 4: Deploy Frontend on Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure:
   - Framework Preset: **Other**
   - Build Command: `npm run build`
   - Output Directory: `dist/public`
   - Install Command: `npm install`
5. Add environment variable:
   - `VITE_API_BASE_URL` = [your backend URL from Step 2]
6. Click "Deploy"
7. Wait for deployment to complete
8. Copy your Vercel URL (e.g., `https://glucover-view.vercel.app`)

### Step 5: Update CORS Configuration

1. Go back to Render Dashboard → `glucover-api` service
2. Update environment variable:
   - `ALLOWED_ORIGINS` = [your Vercel URL from Step 4]
3. Click "Save Changes" (service will redeploy)

### Step 6: Update Vercel Proxy Configuration (if needed)

1. Edit `vercel.json` in your repository
2. Update the `destination` in rewrites to point to your Render backend URL
3. Commit and push changes

✅ **Done!** Your application is now deployed with:
- Production: `https://glucover-view.vercel.app`
- Preview: Automatic preview deployments for each pull request

---

## Option 2: Vercel (Frontend) + Railway (Backend + Database)

### Step 1: Deploy on Railway

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect and deploy your app
5. Click "Add Database" → "PostgreSQL"
6. Railway will automatically set `DATABASE_URL`

### Step 2: Configure Environment Variables

1. In Railway Dashboard, select your service
2. Go to "Variables" tab
3. Add:
   - `NODE_ENV` = `production`
   - `SESSION_SECRET` = [generate random string]
   - `SESSION_COOKIE_SECURE` = `true`
   - `OPENAI_API_KEY` = [optional]
   - `ALLOWED_ORIGINS` = [will be filled later]
4. Click "Settings" → "Generate Domain" to get a public URL

### Step 3: Run Database Migrations

1. In Railway Dashboard, select your service
2. Click "Deploy" tab → "View logs"
3. Once deployed, use Railway CLI or web shell:
   ```bash
   npm run db:push
   ```

### Step 4: Deploy Frontend on Vercel

Follow the same steps as Option 1, Step 4.

### Step 5: Update Railway CORS

1. Go back to Railway → Variables
2. Update `ALLOWED_ORIGINS` with your Vercel URL
3. Redeploy the service

✅ **Done!**

---

## Option 3: Full-Stack on Render (Alternative)

If you prefer a single platform:

1. Deploy backend on Render (as above)
2. Update `vercel.json` → `outputDirectory` → `dist/public`
3. Configure Render to serve static files from backend

---

## Environment Variables Reference

### Backend (Required)

```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:password@host:5432/database
SESSION_SECRET=your-secure-secret-key
SESSION_COOKIE_SECURE=true
```

### Backend (Optional)

```bash
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

### Frontend (Optional)

```bash
VITE_API_BASE_URL=https://your-backend.onrender.com
```

---

## Free Tier Limitations

### Render Free Tier
- Services spin down after 15 minutes of inactivity
- First request may take 30-60 seconds (cold start)
- 750 hours/month of runtime
- PostgreSQL: 1GB storage, 90-day retention

### Vercel Free Tier
- 100GB bandwidth/month
- Automatic HTTPS and CDN
- Unlimited preview deployments

### Railway Free Tier
- $5 free credit/month
- Services pause when credit exhausted

### Neon Free Tier
- 10GB storage
- 1 project
- Auto-suspend after 5 minutes inactivity

### Supabase Free Tier
- 500MB database
- 2GB bandwidth/month
- Auto-pause after 7 days inactivity

---

## Monitoring and Logs

### Render
- Dashboard → Service → Logs
- Events tab for deployment history

### Vercel
- Dashboard → Project → Deployments → View Logs
- Analytics tab for traffic insights

### Railway
- Dashboard → Service → Deploy tab → View Logs
- Metrics for CPU/Memory usage

---

## Troubleshooting

### Backend won't start
1. Check logs in platform dashboard
2. Verify all required environment variables are set
3. Ensure `DATABASE_URL` is correctly formatted
4. Check Node.js version (requires 20.x)

### Database connection errors
1. Verify `DATABASE_URL` format: `postgresql://user:pass@host:port/db`
2. Check if migrations have been run: `npm run db:push`
3. Verify database service is running

### CORS errors
1. Ensure `ALLOWED_ORIGINS` includes your frontend URL
2. Check frontend is using correct `VITE_API_BASE_URL`
3. Verify `SESSION_COOKIE_SECURE=true` for HTTPS

### Cold starts (Render)
- First request after inactivity takes 30-60 seconds
- Consider upgrading to paid tier or using Railway/Fly.io

---

## CI/CD with GitHub Actions

The repository includes `.github/workflows/ci.yml` that automatically:
- Runs TypeScript type checking
- Builds the application
- Runs tests

Both Vercel and Render support automatic deployments:
- **Production**: Deploy on push to `main` branch
- **Preview**: Deploy on pull requests

---

## Security Best Practices

1. **Never commit secrets**: Use platform environment variable managers
2. **Use strong SESSION_SECRET**: Generate with `openssl rand -base64 32`
3. **Enable HTTPS**: Set `SESSION_COOKIE_SECURE=true`
4. **Configure CORS properly**: Set `ALLOWED_ORIGINS` to your frontend domain
5. **Keep dependencies updated**: Run `npm update` regularly
6. **Monitor logs**: Check for suspicious activity

---

## Cost Optimization

All platforms offer free tiers suitable for:
- Development
- Small production deployments
- Low to medium traffic applications

For production with higher traffic:
- Consider paid tiers ($7-20/month)
- Or use managed Postgres (Neon/Supabase) + cheaper compute (Fly.io)

---

## Support

For issues with deployment:
1. Check platform-specific documentation
2. Review application logs
3. Verify environment configuration
4. Check GitHub Issues for known problems
