# Diet Copilot V7 Android authentication

Diet Copilot Android uses the existing THIEPN Account in the canonical Supabase project and Google OAuth with PKCE.

## Native callback

The Android application owns this callback URI:

```text
dev.thiepn.diet://auth-callback/
```

The generated Android manifest registers that scheme/host and the app uses Capacitor App + Browser plugins to:

1. create a Supabase Google OAuth URL without navigating the WebView,
2. open the system browser,
3. receive the callback through the Android deep link,
4. exchange the returned PKCE authorization code inside the original app session,
5. close the browser and refresh the Diet dashboard.

The app must never use the Capacitor WebView origin (`http://localhost`, `https://localhost`, etc.) as a Supabase OAuth redirect URL.

## Required Supabase Auth URL configuration

In the canonical project `hycegznamzjhwinegaai`, open **Authentication → URL Configuration**.

Use a neutral THIEPN site as the shared account fallback Site URL, for example:

```text
https://thiepn.dev/
```

Add the exact native callback to **Redirect URLs**:

```text
dev.thiepn.diet://auth-callback/
```

Keep the web Diet redirect as well:

```text
https://thiepn.dev/diet/
```

Other THIEPN apps can keep their own exact redirect URLs. The shared project's historical `WORDSTRIKE Leaderboard` display name does not need to be changed for Diet authentication, but the Auth Site URL must not point at a stale/nonexistent Wordstrike path.

No Google Cloud OAuth callback change is required: Google continues to return to Supabase Auth, and Supabase then redirects to the application callback.

## Regression guards

A8 verifies:

- Supabase JS uses the PKCE flow,
- the native callback is `dev.thiepn.diet://auth-callback/`,
- Android registers the callback intent filter,
- Capacitor App and Browser plugins are installed,
- the native bridge listens for `appUrlOpen`,
- the authorization code is exchanged with `exchangeCodeForSession`.
