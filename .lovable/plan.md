## Replace shield icon with IAB logo on Sign-in page

Update `src/routes/auth.tsx` to swap the `ShieldCheck` lucide icon in the card header for the existing IAB logo asset (`src/assets/iab-logo.jpeg.asset.json`), matching the treatment already used in the sidebar/header.

### Changes
- Remove `ShieldCheck` import; import `iabLogo from "@/assets/iab-logo.jpeg.asset.json"`.
- Replace the tinted `bg-primary/10` icon tile with a white rounded tile containing `<img src={iabLogo.url} alt="IAB" className="h-9 w-9 object-contain" />`, sized ~h-12 w-12 with a subtle ring/border to sit cleanly on the light background.
- No other content, layout, or auth logic changes.