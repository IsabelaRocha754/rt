// Username rules (DEV_PLAN Phase 1 "username rules + reserved list";
// TRD §4 `profiles.username`).
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_PATTERN = /^[a-z0-9_.]+$/;

export const DISPLAY_NAME_MAX_LENGTH = 50;
export const BIO_MAX_LENGTH = 300;

// Names that would be confusing or impersonation-prone as a username. Not
// exhaustive — extend as new reserved paths/brand terms come up.
export const RESERVED_USERNAMES: readonly string[] = [
  "admin",
  "administrator",
  "root",
  "support",
  "help",
  "api",
  "www",
  "plate",
  "about",
  "terms",
  "privacy",
  "settings",
  "login",
  "signup",
  "signin",
  "logout",
  "me",
  "user",
  "users",
  "profile",
  "profiles",
  "moderator",
  "mod",
  "staff",
  "official",
  "security",
  "abuse",
  "contact",
  "null",
  "undefined",
  "system",
];

export function isValidUsername(username: string): boolean {
  return (
    username.length >= USERNAME_MIN_LENGTH &&
    username.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(username) &&
    !RESERVED_USERNAMES.includes(username)
  );
}
