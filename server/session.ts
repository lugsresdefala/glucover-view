import session from "express-session";
import connectPg from "connect-pg-simple";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const PgStore = connectPg(session);

export function getCookieSecurity() {
  const isProduction = process.env.NODE_ENV === "production";
  const secureCookies =
    (process.env.SESSION_COOKIE_SECURE || "").toLowerCase() === "true" ||
    isProduction;
  const sameSite: "none" | "lax" = secureCookies ? "none" : "lax";
  return { isProduction, secureCookies, sameSite };
}

export function getSession() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to use session storage");
  }

  const { isProduction, secureCookies, sameSite } = getCookieSecurity();
  const sessionSecret = process.env.SESSION_SECRET;

  if (isProduction && !sessionSecret) {
    throw new Error("SESSION_SECRET must be set in production");
  }

  return session({
    secret: sessionSecret || "dev-session-secret",
    store: new PgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: ONE_WEEK_MS / 1000,
      tableName: "sessions",
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: secureCookies,
      sameSite,
      maxAge: ONE_WEEK_MS,
    },
  });
}
