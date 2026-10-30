const express = require('express');
const AuthController = require('../controllers/auth.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimiter.middleware');
const {
  registerSchema,
  loginSchema,
  updateProfileSchema,
} = require('../validations/auth.validation');

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), AuthController.register);
router.post('/login', authLimiter, validate(loginSchema), AuthController.login);
router.get('/profile', authenticate, AuthController.getProfile);
router.patch('/profile', authenticate, validate(updateProfileSchema), AuthController.updateProfile);

module.exports = router;
