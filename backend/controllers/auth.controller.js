import { redis } from "../lib/redis.js";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
  });

  const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
};

const storeRefreshToken = async (userId, refreshToken) => {
  await redis.set(
    `refresh_token:${userId}`,
    refreshToken,
    "EX",
    7 * 24 * 60 * 60,
  ); //7 days
};

const setCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, {
    httpOnly: true, // prevent XSS attacks
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict", // prevent CSRF attach
    maxAge: 15 * 60 * 1000, // 15min
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true, // prevent XSS attacks
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict", // prevent CSRF attach
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7days
  });
};

export const signup = async (req, res) => {
  const { email, password, name } = req.body; // GET from request body
  try {
    const userExists = await User.findOne({ email });

    // check if user exists
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({ name, email, password });

    // Authenticate user
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Store token to Redis
    await storeRefreshToken(user._id, refreshToken);

    // Set Cookie in the browser
    setCookies(res, accessToken, refreshToken);

    // Send response
    res.status(201).json({
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      message: "User created successfully!",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// LOGIN
// Generate tokens and store in Redis
// Set cookies in browser
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.comparePassword(password))) {
      const { accessToken, refreshToken } = generateTokens(user._id); // Generate Tokens

      await storeRefreshToken(user._id, refreshToken); // Store Tokens in Redis
      setCookies(res, accessToken, refreshToken); // Store Tokens in cookie browser

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } else {
      res.status(400).json({ message: "Invalid login credentials" });
    }
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// LOGOUT User
// Clear cookies in browser and Redis
export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      const decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
      );
      await redis.del(`refresh_token:${decoded.userId}`);
    }

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }

  //res.send("logout route is called");
};

// REFRESH TOKEN
export const refreshToken = async (req, res) => {
  try {
    // GET cookie from request
    const refreshToken = req.cookies.refreshToken;

    // Check if cookie has value
    if (!refreshToken) {
      return res.status(400).json({ message: "No refresh token provided" });
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const storedToken = await redis.get(`refresh_token:${decoded.userId}`);

    // Compare tokens
    if (storedToken !== refreshToken) {
      return res.status(401).json({
        message: "Invalid refresh token!",
        decoded: decoded,
        stored: storedToken,
      });
    }

    const accessToken = jwt.sign(
      { userId: decoded.userId },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" },
    );

    res.cookie("accessToken", accessToken, {
      httpOnly: true, // prevent XSS attacks
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict", // prevent CSRF attach
      maxAge: 15 * 60 * 1000, // 15min
    });

    // Response
    res.json({ message: "Token refreshed successfully!" });
  } catch (error) {
    console.log("Error in refreshedToekn controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET profile
export const getProfile = async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
