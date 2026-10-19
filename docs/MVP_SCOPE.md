# MVP Scope — Plate (codename)

The MVP is the version submitted to the App Store and Google Play. If it isn't listed under **In scope**, it isn't built in v1.

## In scope

### Accounts & profile

- Sign up / sign in: email + password, Google, Apple
- Email verification (required before posting, commenting, following)
- Password reset
- 18+ confirmation and Terms/Privacy acceptance at signup
- Profile: username, display name, avatar, bio
- Public / private account toggle
- Language: PT-BR, English
- Settings: privacy, language, blocked users, sign out, sign out of all devices
- Data export (download link)
- Account deletion (in-app)

### Restaurants

- Search (Google Places autocomplete) with optional GPS bias
- Restaurant page (details, average rating, user photos, friends' logs, recent logs)
- Submit a missing restaurant (pending admin approval)

### Logging

- Log a visit — only the restaurant is required
- Optional: date, rating (0.5–5), review, dishes (+ dish rating), up to 4 photos, price per person, companions
- Edit and delete a log
- Diary view on profile (by date)

### Lists

- Want-to-go list
- Custom lists (ranked / unranked, notes), share link

### Social

- Follow / unfollow, follow requests for private accounts, remove follower
- Feed of followed users' logs
- Likes on logs, lists, comments
- Comments on logs and lists
- Companion tag requests (approve / decline / remove myself)
- Activity tab (in-app notifications)
- Report content and users; block; mute

### Stats

- Profile stats (visits, unique restaurants, this year)
- Year in review screen

### Operations

- Admin web panel: reports queue, pending restaurants, remove content, suspend users, audit log
- Sentry error tracking
- Google Places budget alert and usage counters
- Automated backups (provider) + documented restore test

## Out of scope (v1) → backlog

| Feature                                            | Target                           |
| -------------------------------------------------- | -------------------------------- |
| Map view of visited / want-to-go                   | v2                               |
| Push notifications                                 | v1.1                             |
| Premium tier / payments                            | Post-launch                      |
| Following restaurants / restaurant pages by owners | v2+                              |
| Direct messages                                    | Not planned                      |
| Public web profiles (beyond list share page)       | v2                               |
| Import from other apps / Google Maps history       | v2                               |
| Offline logging with sync                          | v1.1                             |
| Recommendations / "for you" algorithm              | v2+                              |
| Hashtags, mentions in reviews                      | v2                               |
| Dish database / menus                              | Not planned                      |
| Under-18 users                                     | Not planned without legal review |

## MVP release criteria

- All flows in `USER_FLOWS.md` work on a physical Android device and an iOS device (via TestFlight).
- Every item in `SECURITY.md` §Checklist is done and verified.
- No open critical/high findings from dependency scan or the pre-launch security review.
- Privacy Policy and Terms published (PT-BR + EN) and linked in-app and in store listings.
- Store requirements: in-app account deletion, Sign in with Apple, report/block for UGC, accurate privacy labels / Data safety form, 18+ age rating.
- Restore from backup tested once on staging.
