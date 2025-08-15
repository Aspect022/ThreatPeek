# Deployment Checklist

## Pre-Deployment

- [ ] All sensitive data removed from code
- [ ] Environment variables properly configured
- [ ] Debug logs commented out
- [ ] Error handling implemented
- [ ] CORS configured for production domains
- [ ] Health check endpoint working

## Backend Deployment (Render)

1. [ ] Create new Web Service on Render
2. [ ] Connect GitHub repository
3. [ ] Set build command: `npm install`
4. [ ] Set start command: `npm start`
5. [ ] Configure environment variables:
   - [ ] `NODE_ENV=production`
   - [ ] `PORT=10000` (Render default)
   - [ ] `FRONTEND_URL=https://your-frontend.vercel.app`
6. [ ] Deploy and test health endpoint: `/api/health`

## Frontend Deployment (Vercel)

1. [ ] Create new project on Vercel
2. [ ] Connect GitHub repository
3. [ ] Set framework preset: Next.js
4. [ ] Configure environment variables:
   - [ ] `GEMINI_API_KEY=your_actual_key`
   - [ ] `NEXT_PUBLIC_API_BASE_URL=https://your-backend.onrender.com/api`
5. [ ] Deploy and test

## Post-Deployment Testing

- [ ] Frontend loads correctly
- [ ] Backend health check responds
- [ ] Scan functionality works
- [ ] AI analysis generates summaries
- [ ] Results display properly
- [ ] Download reports work
- [ ] Error handling works
- [ ] CORS allows frontend-backend communication

## Domain Configuration (Optional)

- [ ] Configure custom domain on Vercel
- [ ] Update CORS origins in backend
- [ ] Update environment variables with new domains
- [ ] Test with custom domains

## Monitoring

- [ ] Set up error monitoring (Sentry, LogRocket, etc.)
- [ ] Monitor API usage and quotas
- [ ] Set up uptime monitoring
- [ ] Configure alerts for failures
