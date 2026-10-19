# User Flows — Plate (codename)

Each flow lists the happy path, then edge cases the implementation must handle. Screen names match `UI_PLAN.md`.

---

## F1. First launch & sign up

1. **Welcome** → "Create account" / "Sign in".
2. Choose method: Apple · Google · Email.
3. **Age & terms**: "I'm 18 or older" checkbox + accept Terms and Privacy Policy (links open in-app browser). Both required.
   - Where the platform provides an age signal (app-store age-range APIs), read it; if it indicates under 18, block signup with a neutral message.
4. Email path: email + password (strength meter, min 10 chars, checked against breached-password list) → verification email sent → **Verify email** screen (resend with cooldown).
5. **Choose username** (live availability check, debounced) + display name.
6. Optional: avatar, bio. Skip allowed.
7. Optional: "Find friends" (search by username). Skip allowed.
8. Land on **Feed** (empty state with "Log your first restaurant").

Edge cases

- Username taken / reserved / invalid chars → inline error.
- OAuth email already used by an email+password account → ask the user to sign in with the original method (no silent account linking).
- Unverified user can browse but posting/following shows a "Verify your email" prompt.
- Signup rate-limited → generic "Try again later" message.

## F2. Sign in / sign out / reset

1. Sign in with Apple/Google/email.
2. Wrong credentials → generic "Email or password incorrect" (no account enumeration).
3. "Forgot password" → always shows "If an account exists, we sent an email".
4. Reset link → set new password → **all other sessions revoked**.
5. Settings → Sign out (this device) / Sign out of all devices.

## F3. Search & open a restaurant

1. **Search** tab → type name (debounced 300 ms, min 2 chars).
2. If location permission not yet asked → ask once ("Use your location to find nearby places?"). Deny = search still works, no bias.
3. Results list (name + area). Tap → **Restaurant** screen.
4. Restaurant screen: header info, average rating, your logs, friends' logs, recent public logs, user photos; actions: **Log**, **Want to go**, **Add to list**.

Edge cases

- No results → "Can't find it? Add it" → F7.
- Google unavailable → results from local DB + banner "Limited results".
- Restaurant permanently closed (from Google) → badge "Closed", still loggable.

## F4. Log a visit (core loop)

Entry points: "+" tab, **Log** button on Restaurant, "Log again" on a past log.

1. If opened from "+": pick restaurant (search sheet; recent restaurants shown first).
2. **Log form** (single scroll, all optional except restaurant):
   - Date (default today; date picker; no future dates)
   - Rating (tap/drag half stars; tap again to clear)
   - Review (multiline, counter at 5,000)
   - Dishes (add rows: name + optional rating; reorder; max 20)
   - Photos (pick up to 4; uploads start in background with progress)
   - Price per person (BRL default; numeric keypad)
   - Companions (search people you follow; max 10)
3. **Save** → optimistic insert into diary → toast "Logged".
4. If restaurant is in want-to-go → prompt "Remove from Want to go?".
5. Tagged companions receive a tag request (F9).

Edge cases

- Save with only restaurant → valid.
- Leaving with unsaved changes → confirm discard.
- Photo upload fails → log still saves; photo shows "Retry".
- Photo rejected by processing → removed with message "This photo couldn't be processed".
- Offline → "You're offline" error; draft kept in memory until the screen closes (offline sync is v1.1).

## F5. Edit / delete a log

1. Open own log → "⋯" → Edit / Delete.
2. Delete → confirm → soft delete; likes/comments hidden; photos deleted by job.

## F6. Want to go & lists

- Want to go: bookmark icon on Restaurant screen (toggle). Profile → Want to go tab.
- Create list: Profile → Lists → "New list" → title, description, ranked toggle → add restaurants (search) → reorder (drag) → notes per item → Save.
- Share list: "⋯" → Share → OS share sheet with link. Link works only if the owner is public.

## F7. Submit a missing restaurant

1. From empty search → "Add it".
2. Form: name (required), city (required), neighborhood/address (optional).
3. Submit → restaurant created with `pending`; user can log it immediately.
4. Banner on that restaurant for the submitter: "Waiting for review".
5. Admin approves → visible to all; rejects → submitter notified; their logs keep working but the restaurant stays hidden from others.

Edge cases

- Similar name in same city already exists → show "Did you mean…?" before creating.
- Limit: 5 submissions/day per user.

## F8. Follow & private accounts

1. Profile of another user → **Follow**.
   - Public → immediately following.
   - Private → "Requested"; owner sees request in Activity → Accept / Decline.
2. Private profiles show only avatar, username, display name, counts, and "This account is private".
3. Owner can remove a follower at any time (Followers list → remove).
4. Switching public → private keeps existing followers; switching private → public auto-accepts pending requests.

## F9. Companion tags

1. Tagged user gets Activity item: "Ana tagged you at Restaurante X" → Accept / Decline.
2. Accepted → tag shows on the log (only to viewers who can view the tagged user).
3. Tagged user can later remove themselves from the log.
4. Declined → creator isn't notified explicitly; tag simply isn't shown.

## F10. Feed, likes, comments

1. **Feed**: cards of followed users' logs (restaurant, rating, short review, first photo, likes/comments count). Pull to refresh, infinite scroll.
2. Like = heart toggle (optimistic).
3. Tap card → **Log detail** → comments thread → write comment (≤ 1,000 chars).
4. Delete own comment; content owner can delete any comment on their content.

Edge cases

- Blocked/muted users never appear.
- Comment rate limit hit → "You're commenting too fast".
- Content deleted while viewing → "This post is no longer available".

## F11. Report, block, mute

1. "⋯" on profile / log / comment / list / photo → **Report** → reason → optional details → Submit → "Thanks, we'll review it".
2. Block from profile "⋯" → confirm → unfollows both ways, removes tags between the two, hides each other everywhere.
3. Mute → their content hidden from your feed; they're not notified.
4. Settings → Blocked users → unblock.

## F12. Activity

List of notifications grouped by day: follows, follow requests (with Accept/Decline inline), likes, comments, tag requests, moderation notices. Opening the tab marks all as read.

## F13. Profile & stats

- Own profile tabs: **Diary** · **Lists** · **Want to go** · **Stats**.
- Stats: totals + link to **Year in review** (year picker; shows "Not enough data" under 3 logs).

## F14. Settings & privacy

- Edit profile · Private account toggle · Language · Location permission info · Blocked users · Change password (email accounts) · Sign out / all devices.
- **Export my data** → job runs → Activity notification with a download link valid 24 h.
- **Delete account** → explain consequences → re-authenticate → type username to confirm → account hidden immediately, data hard-deleted within 30 days → signed out.

## F15. Admin moderation (web)

1. Admin signs in (email + password, TOTP 2FA required).
2. Reports queue (oldest first) → view target in context → Dismiss / Remove content / Suspend user (with reason).
3. Pending restaurants → Approve / Merge into existing / Reject.
4. Every action writes `audit_log`; affected users receive a moderation notice.
