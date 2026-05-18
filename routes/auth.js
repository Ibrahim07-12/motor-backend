import express from "express";
import User from "../models/User.js";
import { generateToken, authenticateToken } from "../middleware/auth.js";

const router = express.Router();
const REGISTRATION_CODE = "Komatsu Jaya";

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password, registrationCode } = req.body;

    if (!email || !password || !registrationCode) {
      return res.status(400).json({ error: "Email, password, and registration code required" });
    }

    if (registrationCode !== REGISTRATION_CODE) {
      return res.status(403).json({ error: "Invalid registration code" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedEmail }],
    });
    if (existingUser) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const newUser = new User({
      username: normalizedEmail,
      email: normalizedEmail,
      password,
    });
    await newUser.save();

    const token = generateToken(newUser._id, newUser.username);

    res.status(201).json({
      message: "User registered successfully",
      user: { id: newUser._id, email: newUser.email, username: newUser.username },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedEmail }],
    });
    if (!user) {
      return res.status(401).json({ error: "Account not registered or invalid password" });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Account not registered or invalid password" });
    }

    const token = generateToken(user._id, user.username);

    res.json({
      message: "Login successful",
      user: { id: user._id, email: user.email, username: user.username },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/verify
router.get("/verify", authenticateToken, (req, res) => {
  res.json({
    message: "Token is valid",
    user: req.user,
  });
});

export default router;
