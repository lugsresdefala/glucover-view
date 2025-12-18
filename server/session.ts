import session from "express-session";
import connectPg from "connect-pg-simple";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const PgStore = connectPg(session);

export function getSession() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to use session storage");
  }

  const sessionSecret = process.env.SESSION_SECRET || "dev-session-secret";

  return session({
    secret: sessionSecret,
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
      secure: process.env.NODE_ENV === "production",
      maxAge: ONE_WEEK_MS,
    },
  });
}
