import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GithubStrategy } from "passport-github2";
import { Strategy as FacebookStrategy } from "passport-facebook";
import passport from "passport";
import "dotenv/config"
import dotenv from "dotenv";
import { db } from "@repo/db";

dotenv.config();


const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;

export function initPassport(){
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET || !FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
    throw new Error('Missing environment variables for authentication providers');
  }
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/callback", 
      },

      async function (accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: any) => void) {
        const user = await db.user.upsert({
          create: {
            email: profile.emails[0].value,
            name: profile.displayName,
            provider: "GOOGLE",
          },
          update: {
            name: profile.displayName,
          },
          where: {
            email: profile.emails[0].value,
          }
        });

        done(null, user);
      }
    )
  );

  passport.use(
    new GithubStrategy(
      {
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: "/auth/github/callback",
      },
      async function (accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: any) => void) {
        const user = await db.user.upsert({
          create: {
            email: profile.emails[0].value,
            name: profile.displayName,
            provider: "GITHUB",
          },
          update: {
            name: profile.displayName,
          },
          where: {
            email: profile.emails[0].value,
          }
        });
        done(null, user);
      }
    )
  );

  passport.serializeUser(function(user: any, cb){
    process.nextTick(function(){
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture
      });
    });
  });

  passport.deserializeUser(function(user: any, cb){
    process.nextTick(function(){
      return cb(null, user);
    });
  });
}

// passport.use(
//   new FacebookStrategy(
//     {
//       clientID: FACEBOOK_APP_ID,
//       clientSecret: FACEBOOK_APP_SECRET,
//       callbackURL: "/auth/facebook/callback",
//     },
//     function (accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: any) => void) {
//       done(null, profile);
//     }
//   )
// );

// passport.serializeUser((user: any, done: (error: any, id?: any) => void) => {
//   done(null, user);
// });

// passport.deserializeUser((user: any, done: (error: any, user?: any) => void) => {
//   done(null, user);
// });
