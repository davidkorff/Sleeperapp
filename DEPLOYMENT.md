# Deploying to Vercel

This guide will help you deploy the Sleeper Trade Analyzer to Vercel for free hosting.

## Prerequisites

- A GitHub account (to store your code)
- A Vercel account (sign up at [vercel.com](https://vercel.com))

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Push your code to GitHub**
   ```bash
   # If you haven't already, initialize git and push
   git add .
   git commit -m "Ready for deployment"
   git push
   ```

2. **Sign up or log in to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with your GitHub account

3. **Import your repository**
   - Click "Add New Project"
   - Select "Import Git Repository"
   - Choose your GitHub repository
   - Click "Import"

4. **Configure your project**
   - **Framework Preset:** Other
   - **Root Directory:** `./`
   - **Build Command:** Leave empty (static site)
   - **Output Directory:** `./`
   - Click "Deploy"

5. **Wait for deployment**
   - Vercel will deploy your site in seconds
   - You'll get a URL like `your-project.vercel.app`

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```

4. **Follow the prompts**
   - Link to existing project? No
   - Project name? (use default or customize)
   - Directory? `./`
   - Override settings? No

5. **Deploy to production**
   ```bash
   vercel --prod
   ```

## Custom Domain (Optional)

1. Go to your project in Vercel dashboard
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Update your DNS records as instructed by Vercel

## Environment Variables

This project doesn't require any environment variables as it uses the public Sleeper API directly from the browser.

## Automatic Deployments

Once connected to GitHub, Vercel will automatically deploy:
- **Production:** When you push to `main` branch
- **Preview:** When you create pull requests

## Vercel Configuration

The `vercel.json` file in this project configures:
- Static file serving for HTML, CSS, and JavaScript
- Route mapping:
  - `/` → Login page (`login.html`)
  - `/app` → Main application (`index.html`)

## Troubleshooting

### Issue: 404 errors on routes

**Solution:** Make sure your `vercel.json` file is in the root directory and properly configured.

### Issue: Files not updating

**Solution:**
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Check Vercel deployment logs

### Issue: API calls failing

**Solution:**
1. Check browser console for CORS errors
2. Verify Sleeper API is accessible: https://api.sleeper.app/v1/players/nfl
3. Check Vercel function logs if using serverless functions

## Performance Optimization

Vercel automatically optimizes:
- ✅ Global CDN distribution
- ✅ Automatic HTTPS
- ✅ Gzip compression
- ✅ Edge caching

## Monitoring

- View deployment logs in Vercel dashboard
- Monitor performance in Vercel Analytics (free tier available)
- Check function invocations and errors

## Cost

This project uses Vercel's **free tier**, which includes:
- Unlimited deployments
- 100 GB bandwidth per month
- Automatic SSL certificates
- Global CDN

## Support

- Vercel Documentation: https://vercel.com/docs
- Vercel Community: https://github.com/vercel/vercel/discussions
- Sleeper API Docs: https://docs.sleeper.com/

## Next Steps After Deployment

1. Share your deployment URL with friends
2. Test the login flow with your Sleeper username
3. Analyze trades and dominate your fantasy league!

---

**Live URL Example:** `https://sleeper-trade-analyzer.vercel.app`

Happy analyzing! 🏈
