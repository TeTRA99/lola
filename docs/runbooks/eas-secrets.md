# EAS secrets runbook (E6.1)

The production build needs `EXPO_PUBLIC_OPENROUTER_API_KEY` injected at build time without ever touching the repo.

## One-time setup

Get a key from <https://openrouter.ai/keys> (the free tier is fine — NFR-2a budget is $30/mo at single-user volume, well under the platform's per-key limits).

```bash
cd app
npx eas-cli@latest secret:create \
    --scope project \
    --name EXPO_PUBLIC_OPENROUTER_API_KEY \
    --value sk-or-v1-REPLACE_WITH_REAL_KEY
```

The secret lives in EAS' encrypted store, scoped to this project. Verify:

```bash
npx eas-cli@latest secret:list
```

## How the build reads it

`app/eas.json` `build.production.env` maps the local env var to the secret reference:

```jsonc
"env": {
  "EXPO_PUBLIC_OPENROUTER_API_KEY": "$EXPO_PUBLIC_OPENROUTER_API_KEY"
}
```

EAS substitutes the value from its secret store at build time. The compiled JS bundle then carries the literal — no runtime fetch needed.

Dev builds (the `development` and `preview` profiles) read from your local `.env.local` instead. Don't commit that file.

## Rotating the key

```bash
npx eas-cli@latest secret:delete EXPO_PUBLIC_OPENROUTER_API_KEY
npx eas-cli@latest secret:create --name EXPO_PUBLIC_OPENROUTER_API_KEY --value <new-key>
```

Then trigger a fresh production build. Old builds keep working until the previous key is revoked in OpenRouter's dashboard.

## Sanity check (CI / pre-commit hook future work)

```bash
# Quick check that no key snuck into the repo:
git grep "sk-or-v1-" -- ':!*.example' ':!docs/'
# Should return nothing.
```
