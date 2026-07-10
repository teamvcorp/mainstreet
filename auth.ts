import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { loginSchema } from "@/schemas/auth";

/**
 * Google is OPTIONAL. Email/password (Credentials) works fully on its own.
 * We only register the Google provider when its env is present, so there are no
 * warnings or dead buttons in a credentials-only setup.
 */
export const googleAuthEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

/**
 * Full Auth.js setup (Node runtime). Uses JWT sessions and upserts users into
 * our own Mongoose `users` collection (no adapter) so the User model stays the
 * single source of truth for roles, town, favorites, etc.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    ...(googleAuthEnabled
      ? [
          Google({
            // Lets a Google login attach to an existing email/password account
            // with the same verified email.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        await connectToDatabase();
        // passwordHash is select:false — request it explicitly for the compare.
        const user = await User.findOne({ email }).select("+passwordHash");
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    /**
     * On initial sign-in (`user` present) enrich the token with our DB user id
     * and role. For Google logins we upsert the user first. On subsequent
     * requests `user` is undefined, so this is a no-op (no DB hit) — the proxy
     * never triggers this branch.
     */
    async jwt({ token, user, account, trigger }) {
      if (user?.email) {
        const email = user.email;
        await connectToDatabase();
        let dbUser = await User.findOne({ email });
        if (!dbUser && account?.provider === "google") {
          dbUser = await User.create({
            email,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
            role: "consumer",
            emailVerified: new Date(),
          });
        }
        if (dbUser) {
          token.id = dbUser._id.toString();
          token.role = dbUser.role;
        }
      } else if (trigger === "update" && token.id) {
        // Client called session.update() (e.g. after becoming a seller) — refresh
        // the role from the DB so the proxy/UI see it without a full re-login.
        await connectToDatabase();
        const dbUser = await User.findById(token.id).select("role");
        if (dbUser) token.role = dbUser.role;
      }
      return token;
    },
  },
});
