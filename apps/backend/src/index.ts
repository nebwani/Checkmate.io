import express from "express";
import v1Router from "./router/v1.js";
import cors from "cors"
import passport from "passport";
import { initPassport } from "./passport.js";
import session from 'express-session';
import authRoute from "./router/auth.js";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import "dotenv/config";

const app = express();
app.use(cookieParser());

dotenv.config({
  path: new URL("../.env", import.meta.url).pathname,
});

const isProd = process.env.CLIENT_URL !== "http://localhost:5173";

if (isProd) {
  app.set("trust proxy", 1);
}

app.use(session({
  name: "session",
  secret: process.env.SESSION_SECRET || "keyboard-cat",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,          
    sameSite: isProd ? "none" : "lax",     
    maxAge: 24 * 60 * 60 * 1000,
  }
}));


initPassport();
app.use(passport.initialize());
app.use(passport.session());

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    methods: "GET,POST,PUT,DELETE",
    credentials: true,
  })
);

app.use("/auth", authRoute);
app.use("/v1", v1Router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
