# Quick Start - Deploy to Free Platforms

This guide gets you from zero to deployed in under 10 minutes.

## Prerequisites
- GitHub account
- Vercel account (sign up with GitHub)
- Render account (sign up with GitHub) OR Railway account

## Option A: Vercel + Render (Recommended)

### 1. Fork/Clone Repository
```bash
git clone https://github.com/lugsresdefala/glucover-view.git
cd glucover-view
```

### 2. Deploy Database (2 minutes)
1. Go to [render.com/dashboard](https://dashboard.render.com/)
2. Click **New** → **PostgreSQL**
3. Name: `glucover-db`
4. Choose **Free** plan
5. Click **Create Database**
6. Copy the **External Database URL** (starts with `postgresql://`)

### 3. Deploy Backend (3 minutes)
1. In Render, click **New** → **Web Service**
2. Connect GitHub and select your repository
3. Configuration:
   - **Name**: `glucover-api`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free
4. Environment Variables:
   ```
   NODE_ENV = production
   PORT = 5000
   DATABASE_URL = [paste your database URL]
   SESSION_SECRET = [generate with: openssl rand -base64 32]
   SESSION_COOKIE_SECURE = true
   ```
5. Click **Create Web Service**
6. Wait for deployment (~3 min)
7. Copy your backend URL (e.g., `https://glucover-api.onrender.com`)

### 4. Initialize Database (1 minute)
1. In Render, go to your `glucover-api` service
2. Click **Shell** tab
3. Run:
   ```bash
   npm run db:push
   ```
4. Wait for "✅ Success" message

### 5. Deploy Frontend (2 minutes)
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Configuration:
   - **Framework Preset**: Other
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/public`
   - **Install Command**: `npm install`
5. Environment Variables:
   ```
   VITE_API_BASE_URL = [your backend URL from step 3]
   ```
6. Click **Deploy**
7. Wait for deployment (~2 min)
8. Copy your Vercel URL (e.g., `https://glucover-view.vercel.app`)

### 6. Configure CORS (1 minute)
1. Go back to Render → your `glucover-api` service
2. Environment Variables → Add:
   ```
   ALLOWED_ORIGINS = [your Vercel URL from step 5]
   ```
3. Click **Save** (service will auto-redeploy)

### ✅ Done!
Visit your Vercel URL to see your deployed app.

---

## Option B: Railway (All-in-One)

### 1. Deploy to Railway
1. Go to [railway.app](https://railway.app)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository
4. Railway auto-detects the app

### 2. Add Database
1. In your Railway project, click **New**
2. Select **Database** → **PostgreSQL**
3. Railway automatically sets `DATABASE_URL`

### 3. Configure Environment
1. Click your service → **Variables**
2. Add:
   ```
   NODE_ENV = production
   SESSION_SECRET = [random string]
   SESSION_COOKIE_SECURE = true
   ```

### 4. Generate Domain
1. Click **Settings** → **Generate Domain**
2. Copy the domain (e.g., `glucover-api.up.railway.app`)

### 5. Run Migrations
1. In Railway, click **Deploy** → wait for completion
2. Use Railway CLI or web shell:
   ```bash
   npm run db:push
   ```

### 6. Deploy Frontend on Vercel
Follow steps from Option A, Step 5.

---

## Testing Your Deployment

1. Visit your frontend URL
2. Try creating an account
3. Import sample glucose data
4. Verify the analysis works

---

## Common Issues

### Backend won't start
- Check logs in platform dashboard
- Verify all environment variables are set
- Ensure `DATABASE_URL` format is correct

### Database connection error
- Make sure migrations were run: `npm run db:push`
- Check database service is running
- Verify connection string format

### Frontend can't reach backend
- Check `VITE_API_BASE_URL` matches your backend URL
- Verify `ALLOWED_ORIGINS` in backend includes frontend URL
- Check browser console for CORS errors

### "Cold start" delay (Render)
- Free tier services sleep after 15 min inactivity
- First request takes 30-60 seconds to wake up
- Subsequent requests are fast

---

## Adding OpenAI (Optional)

To enable AI-powered recommendations:

1. Get API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. Add to backend environment:
   ```
   OPENAI_API_KEY = sk-...
   ```
3. Redeploy backend

---

## Next Steps

- Set up custom domain (Vercel supports free custom domains)
- Enable automatic deployments for preview branches
- Configure monitoring and alerts
- Review security settings

---

## Getting Help

- Check full deployment guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Review application docs: [README.md](./README.md)
- Open GitHub issue for bugs or questions
