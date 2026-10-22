// Password policy (DEV_PLAN Phase 1, SECURITY.md "Hash passwords": min 10 chars).
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

// Common disposable/temporary email domains, checked at signup
// (SECURITY.md "Add bot protection" > disposable-email blocklist). Not
// exhaustive — a determined abuser can always find a new domain — this only
// raises the bar for casual throwaway signups.
export const DISPOSABLE_EMAIL_DOMAINS: readonly string[] = [
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.biz",
  "guerrillamail.de",
  "sharklasers.com",
  "grr.la",
  "10minutemail.com",
  "10minutemail.net",
  "temp-mail.org",
  "tempmail.com",
  "tempmail.net",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
  "yopmail.net",
  "getnada.com",
  "maildrop.cc",
  "mailnesia.com",
  "mintemail.com",
  "dispostable.com",
  "fakeinbox.com",
  "discard.email",
  "mailcatch.com",
  "moakt.com",
  "mohmal.com",
  "spambog.com",
  "tempinbox.com",
  "emailondeck.com",
  "33mail.com",
];
