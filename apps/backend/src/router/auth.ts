import express from "express"
import { Router, Request, Response } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import strict from "node:assert/strict";
import {db} from "@repo/db"

const router = Router();

const CLIENT_URL = "https://checkmate-io-frontend.vercel.app/game/random";
const JWT_SECRET = process.env.JWT_SECRET || 'chess_super_secret';

interface User {
  id: string;
}

router.get("/refresh", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");

  if (req.user) {
    const user = req.user as User;

    const userDb = await db.user.findFirst({
      where: { id: user.id }
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);

    return res.status(200).json({
      token,
      id: user.id,
      name: userDb?.name,
    });
  }

  return res.status(401).json({ message: "Unauthorized" });
});




router.get("/login/failed", (req: Request, res: Response) => {
  res.status(401).json({
    success: false,
    message: "failure",
  });
});


router.get("/logout", (req: Request, res: Response) => {
  req.logout((err) => {
    if(err){
      console.log('Error logging out:', err);
      res.status(500).json({error : 'Failed to log out'});
    } else {
      res.clearCookie('jwt');
      res.redirect("https://checkmate-io-frontend.vercel.app/");
    }
  });
});


router.get("/google", passport.authenticate('google', { scope: ['profile', 'email'] }));


router.get(
  '/google/callback',
  passport.authenticate("google", { session: true }),
  async (req: Request, res: Response) => {
    const user = req.user as { id: string };

    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("jwt", token, {
      httpOnly: true,
      secure: true,           
      sameSite: "none",      
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect("https://checkmate-io-frontend.vercel.app/game/random");
  }
);


router.get('/github', passport.authenticate('github', { scope: ['profile', 'email'] }));

router.get(
  '/github/callback',
  passport.authenticate("github", {
    successRedirect: CLIENT_URL,
    failureRedirect: '/login/failed',
  })
);

router.get('/facebook', passport.authenticate('facebook', { scope: ['profile'] }));

router.get(
  '/facebook/callback',
  passport.authenticate('facebook', {
    successRedirect: CLIENT_URL,
    failureRedirect: '/login/failed',
  })
);

export default router;