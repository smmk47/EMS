// User routes
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const redisClient = require('../db/redis');

// Middleware to authenticate JWT
tokenAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
    
    if (!token) return res.sendStatus(401);

    // Verify if token exists in Redis
    const isBlacklisted = await redisClient.get(`bl_${token}`);
    if (isBlacklisted) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  } catch (error) {
    console.error('Auth error:', error);
    return res.sendStatus(403);
  }
};

// Public routes
router.post('/signup', userController.signup);
router.post('/login', userController.login);

// Protected routes
router.post('/logout', tokenAuth, userController.logout);
router.get('/me', tokenAuth, userController.getMe);

// User management routes (for both managers and employees)
router.put('/users/:id?', tokenAuth, userController.updateUser);

// Manager-only routes
router.get('/employees', tokenAuth, userController.getEmployees);
router.delete('/employees/:id', tokenAuth, userController.deleteEmployee);

module.exports = router;
