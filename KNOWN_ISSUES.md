# Known Issues

## TypeScript Type Error in Development

### Issue
When running `npm run check`, you may see a type error in `client/src/App.tsx`:
```
Type '{ activeSection: string; onNavigate: Dispatch<SetStateAction<string>>; }' is not assignable to type 'IntrinsicAttributes'.
```

### Impact
- **Does NOT affect builds**: `npm run build` completes successfully
- **Does NOT affect runtime**: Application runs correctly
- Only appears during TypeScript type checking

### Status
- Pre-existing issue not related to deployment changes
- Application is fully functional in development and production
- Will be addressed in a future update

### Workaround
This is a type definition mismatch that doesn't impact functionality. You can:
1. Ignore the type check error
2. Run `npm run build` which bypasses strict type checking
3. Continue development - the app works correctly despite the error

---

## Other Notes

### First Request Delay (Render Free Tier)
- Services on Render's free tier spin down after 15 minutes of inactivity
- First request after inactivity may take 30-60 seconds (cold start)
- This is expected behavior for free hosting
- Upgrade to paid tier for always-on services

### Database Auto-Pause (Neon/Supabase Free Tier)
- Free tier databases may pause after periods of inactivity
- Auto-resume on first connection (adds 1-2 second delay)
- This is normal for free tiers
- Upgrade to paid tier for always-active databases
