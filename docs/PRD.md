# PRD — Plate (codename)

## 1. Summary

Plate is a social diary for restaurants, modeled on Letterboxd. People log the restaurants they visit, rate and review them, track what they ordered, keep a list of places they want to try, build shareable lists, and follow friends to see where they're eating.

## 2. Goals

- Make logging a restaurant visit fast (under 15 seconds for a rating-only log).
- Give users a personal history they enjoy revisiting (diary, stats, year in review).
- Make discovery social: trusted recommendations from people you follow, not anonymous star averages.
- Launch publicly on iOS and Android with a security and privacy posture fit for real users.

## 3. Non-goals (v1)

- Restaurant owner accounts, reservations, delivery, menus, payments.
- Map view (planned for v2).
- Premium tier (planned; architecture keeps a `plan` field).
- Ads (decided: none).
- Direct messages.
- Push notifications (v1.1; v1 has the in-app Activity tab).
- Web app for end users (only an internal admin panel).

## 4. Target users

- **Primary:** adults (18+) in Brazil who eat out regularly and like keeping track — the "foodie friend" people ask for recommendations.
- **Secondary:** English-speaking users and travelers.

Minimum age is **18**. See SECURITY.md §Legal for the reasoning (Brazil's ECA Digital, Lei 15.211/2025).

## 5. Core concepts

| Concept     | Letterboxd equivalent | Notes                                                   |
| ----------- | --------------------- | ------------------------------------------------------- |
| Restaurant  | Film                  | From Google Places or user-submitted (pending approval) |
| Log (visit) | Diary entry           | A user can log the same restaurant many times           |
| Rating      | Rating                | 0.5–5 stars, optional                                   |
| Review      | Review                | Optional text on a log                                  |
| Want to go  | Watchlist             | Bookmark a restaurant                                   |
| List        | List                  | Ranked or unranked collection with notes                |
| Follow      | Follow                | Requires approval if the account is private             |

## 6. Features (v1)

### 6.1 Accounts

- Sign up / sign in with email + password, Google, or Apple.
- Email verification required before posting content.
- Profile: username, display name, avatar, short bio.
- Account privacy: **public by default**, optional **private** (followers need approval).
- Language: PT-BR and English (follows device, changeable in settings).
- Data export and full account deletion from inside the app.

### 6.2 Restaurants

- Search by name, with optional location bias from GPS (used only during search, never stored).
- Restaurant page: name, address/area, user photos, average rating, friends' logs, actions: log, want to go, add to list.
- "Can't find it?" → submit a restaurant (name, city, neighborhood/address). Usable by the submitter immediately, hidden from others until an admin approves.

### 6.3 Logging a visit

Only the restaurant is required. Everything else is optional:

- Visit date (defaults to today, editable, not in the future)
- Rating (0.5–5)
- Review text
- Dishes ordered (name + optional rating per dish)
- Photos (up to 4)
- Price paid per person
- Companions (tagged users must approve before the tag is shown)

### 6.4 Lists & want-to-go

- Want-to-go: one tap from any restaurant; logging a visit offers to remove it.
- Custom lists: title, description, ranked or unranked, note per item, shareable link.

### 6.5 Social

- Follow / unfollow; follow requests for private accounts.
- Feed: recent logs from people you follow.
- Likes and comments on logs and lists.
- Activity tab: follows, follow requests, likes, comments, tag requests.
- Report, block, mute.

### 6.6 Stats

- Profile stats: total visits, unique restaurants, visits this year.
- Year in review: visits per month, top-rated, most-visited, most-ordered dishes, average spend. (Candidate for premium later; free in v1.)

## 7. Success metrics

- Activation: % of new users who log ≥1 visit within 7 days.
- Retention: D30 retention; logs per active user per month.
- Social: % of users following ≥3 people.
- Safety: reports resolved within 48h; zero critical findings in the pre-launch security review.
- Cost: Google Places spend stays under the budget alert.

## 8. Monetization

Free at launch, no ads. A premium tier may come later (e.g. advanced stats, profile themes). The `plan` column exists from day one; no paywall code in v1.

## 9. Constraints

- Solo developer, no deadline — prefer simple, well-documented tools.
- Developer machine: Windows + WSL, no Mac → iOS builds via EAS cloud builds.
- Google Places pricing: free per-SKU monthly caps, then paid per 1,000 calls. Requires caching within Google's terms and a billing budget alert.
- LGPD; ECA Digital (18+ policy); App Store and Google Play policies (in-app account deletion, Sign in with Apple, UGC moderation tools: report, block, content removal).

## 10. Open questions

- Final product name and visual identity (check App Store, Google Play, INPI).
- Legal review of Terms of Service, Privacy Policy and age policy before launch.
- Premium tier contents and price (post-launch).
