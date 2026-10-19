# UI Plan — Plate (codename)

## 1. Navigation

Bottom tab bar (Expo Router `(tabs)` group):

| Tab      | Icon          | Screen                 | Purpose                         |
| -------- | ------------- | ---------------------- | ------------------------------- |
| Feed     | home          | `FeedScreen`           | Followed users' logs            |
| Search   | magnifier     | `SearchScreen`         | Restaurants + people            |
| **+**    | plus (accent) | opens `LogSheet` modal | Log a visit from anywhere       |
| Activity | bell (badge)  | `ActivityScreen`       | Notifications, requests         |
| Profile  | avatar        | `ProfileScreen` (own)  | Diary, lists, want to go, stats |

Stack screens pushed from any tab: `Restaurant`, `LogDetail`, `UserProfile`, `ListDetail`, `ListEditor`, `Followers/Following`, `YearInReview`, `Settings/*`, `ReportSheet`.

Auth stack (outside tabs): `Welcome`, `SignIn`, `SignUp`, `AgeTerms`, `VerifyEmail`, `ChooseUsername`, `ProfileSetup`, `FindFriends`, `ForgotPassword`.

Deep links: `plate://list/:slug`, `plate://log/:id`, `plate://u/:username` (scheme renamed with the product). Universal/App Links for list shares.

## 2. Screens

### Feed

- Log cards: avatar + name, restaurant name + area, stars, date, review excerpt (3 lines), first photo (16:9), like/comment counts.
- Empty state: illustration + "Follow friends" and "Log your first restaurant" buttons.
- Pull to refresh; infinite scroll with skeleton loaders.

### Search

- Segmented control: **Restaurants** | **People**.
- Restaurants: recent searches, results list, "Can't find it? Add it" footer.
- People: username search.

### Restaurant

- Header: name, area/address, "Closed" badge if applicable, Google attribution.
- Rating summary: average + histogram (half-star buckets) + count.
- Action row: **Log** (primary), **Want to go** (bookmark toggle), **Add to list**.
- Sections: Your visits · Friends · Photos (grid) · Recent logs.
- "⋯": report restaurant (wrong info / doesn't exist).

### Log sheet / Log form (modal)

- Restaurant picker (if not preset).
- Fields in order: Date · Rating · Review · Dishes · Photos · Price · Companions.
- Collapsed "Add details" section for dishes/photos/price/companions so a rating-only log stays one screen.
- Sticky **Save** button; disabled only while restaurant is missing.

### Log detail

- Full review, dishes (with mini stars), photo carousel, price, accepted companions, date.
- Like, comments thread, comment composer.
- Owner "⋯": Edit, Delete. Others: Report, Mute/Block author.

### Profile (own & others)

- Header: avatar, display name, @username, bio, counts (visits, followers, following), Follow/Requested/Following button (others) or Edit profile (own).
- Tabs: **Diary** (grouped by month) · **Lists** · **Want to go** · **Stats**.
- Private + not following: header only + lock message.

### Activity

- Grouped by Today / This week / Earlier.
- Inline actions for follow requests and tag requests.

### List detail / editor

- Title, description, owner, item count; ranked numbers if ranked.
- Editor: drag handles, per-item note, add via search.

### Year in review

- Vertical story: total visits → visits per month (bar chart) → top-rated → most visited → favorite dishes → average spend. Share as image (generated client-side, no personal data beyond what's shown).

### Settings

- Account · Privacy (private toggle, blocked users) · Language · Notifications (placeholder) · Data (export, delete account) · About (Terms, Privacy, licenses, app version).

## 3. Design system

- **Theme:** light and dark mode from day one (follows system, override in settings). Colors as tokens in `apps/mobile/src/theme/tokens.ts`; never hard-code hex values in components.
- **Brand:** placeholder until the name is chosen — one accent color for primary actions and stars, neutral greys elsewhere.
- **Typography:** system fonts (SF / Roboto) with a 5-step scale; supports Dynamic Type / font scaling up to 200% without clipping.
- **Spacing:** 4-pt grid (4, 8, 12, 16, 24, 32).
- **Touch targets:** ≥ 44×44 pt.
- **Stars:** custom `StarRating` component supporting half stars, accessible as an adjustable control ("3.5 of 5 stars").
- **Images:** `expo-image` with blurhash placeholders, rounded corners, 16:9 in cards, 1:1 in grids.

### Core components (`apps/mobile/src/components`)

`Button`, `IconButton`, `TextField`, `TextArea` (with counter), `StarRating`, `Avatar`, `LogCard`, `RestaurantRow`, `UserRow`, `ListCard`, `PhotoGrid`, `PhotoPicker`, `DishEditor`, `CompanionPicker`, `EmptyState`, `Skeleton`, `Toast`, `ConfirmDialog`, `ActionSheet`, `ReportSheet`, `SegmentedControl`, `Badge`.

## 4. UX rules

- Logging a rating-only visit takes ≤ 3 taps after choosing the restaurant.
- Optimistic UI for likes, want-to-go, follow (with rollback on error).
- Every list screen has loading (skeleton), empty, and error (retry) states.
- Destructive actions always confirm; account deletion requires typing the username.
- Error messages are human and translated; never show raw API errors.
- Permission prompts (location, photos) appear only at the moment of use, with a short explanation first.

## 5. Accessibility

- All interactive elements have `accessibilityLabel` and role.
- Color contrast WCAG AA in both themes.
- Screen reader order matches visual order; images have alt text ("Photo of a dish at …").
- Respect reduce-motion.

## 6. i18n

- Keys in `apps/mobile/src/i18n/{pt-BR,en}.json`, namespaced by screen (`log.form.rating`).
- Dates and currency formatted with `Intl` per locale (`R$ 45,00` vs `R$45.00`).
- Pluralization via i18next.
- Product name comes from a single constant.
