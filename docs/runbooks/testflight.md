# TestFlight runbook (E6.2)

iOS distribution path for Charly's parallel-test device (and any future audience expansion). Apple Dev enrollment, App Store Connect config, and TestFlight beta review are all interactive — this runbook walks through them.

## 1. Apple Developer Program enrollment ($99/yr)

- Sign in at <https://developer.apple.com> with your Apple ID
- Enroll as an Individual ($99/yr USD)
- Identity verification: 1–2 days typical, occasionally longer
- Once approved, note your **Team ID** (alphanumeric, top of the membership page)

If you already have an Apple Developer account from a previous project, skip to step 2.

## 2. App Store Connect app create

- <https://appstoreconnect.apple.com> → My Apps → + → New App
- Platform: iOS
- Name: "Lola" (changeable later)
- Primary Language: Spanish (Latin America)
- Bundle ID: `com.carlosbernardi.lola` (must match `app.json` exactly)
- SKU: any unique string (e.g. `lola-v09`)

The URL after creation contains your **ASC App ID** (numeric). Note it down.

## 3. EAS Submit config

Edit `app/eas.json` `submit.production.ios`:

```jsonc
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890"
      }
    }
  }
}
```

Commit this — it's not a secret (the App Store URL exposes the same info).

## 4. First build + submit

```bash
cd app

# One-time interactive — sets up signing certs in EAS' managed store
npx eas-cli@latest credentials

# Build the production IPA (~15–20 min on free tier)
npx eas-cli@latest build -p ios --profile production

# Submit to App Store Connect → TestFlight processing
npx eas-cli@latest submit -p ios --latest
```

Apple's processing takes 5–15 minutes after submit. You'll get an email when TestFlight is ready.

## 5. TestFlight Internal Testing onboarding

- App Store Connect → Apps → Lola → TestFlight → Internal Testing
- + → Create group → name it (e.g. "Charly")
- Add testers (your Apple ID + any family members you want to test the iOS build)
- Pick the latest processed build → assign to group

## 6. Install on iOS device

- App Store on Charly's iOS → search for "TestFlight" → install (first-time only)
- Open TestFlight → accept the invite that landed in email
- Tap "Install" next to Lola → app installs alongside other apps
- Open Lola → same smoke test as the Android runbook (greeting + Describe + Ask)

## 7. Updates

Same flow as first build — `eas build` then `eas submit --latest`. TestFlight users get a notification of the new build; install with one tap.

## 8. Going public (post-v0.9, not in scope here)

The Brief explicitly defers App Store distribution to v1.5+. For v0.9, TestFlight Internal Testing is the channel — no Apple review, no public store listing.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `eas submit` fails on credentials | Apple Dev not approved yet, or 2FA challenge | Wait + retry; `eas credentials` to re-auth |
| Build succeeds but TestFlight processing hangs >1h | Apple-side queue | Check App Store Connect → Activity; resubmit if Failed |
| "Invalid Bundle ID" on submit | `app.json` and ASC differ | Recreate the App Store Connect app with the right bundle ID |
| Build expires from TestFlight (90-day limit) | TestFlight builds auto-expire after 90 days | Build + submit a new version |
