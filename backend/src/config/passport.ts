import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { UserRepository } from '../repositories/UserRepository';
import dotenv from 'dotenv';
import { getEnv } from './env';

dotenv.config();

const userRepository = new UserRepository();

const googleClientId = process.env.GOOGLE_CLIENT_ID || 'mock_client_id';
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || 'mock_client_secret';
// Determine callback URL based on environment (development vs production)
const callbackURL = getEnv('GOOGLE_CALLBACK_URL', 'http://localhost:5000/auth/google/callback');

passport.use(
  new GoogleStrategy(
    {
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: callbackURL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Upsert Google user into our database (acting as Tenant)
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : '';
        const user = await userRepository.upsertGoogleUser({
          googleId: profile.id,
          name: profile.displayName,
          email: email,
          avatar: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : undefined,
        });

        // Pass the user object to passport
        return done(null, user);
      } catch (err) {
        console.error('Error during Google Strategy callback:', err);
        return done(err, false);
      }
    }
  )
);

// Serialize user into the session (storing just the ID to keep the session payload small)
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from the session using the stored ID
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await userRepository.findById(id);
    if (!user) {
      return done(null, false);
    }
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
