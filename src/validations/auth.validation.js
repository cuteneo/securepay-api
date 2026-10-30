const { z } = require('zod');

const registerSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address')
      .toLowerCase()
      .trim(),
    username: z
      .string({ required_error: 'Username is required' })
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username cannot exceed 30 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric characters and underscores')
      .trim(),
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    fullName: z
      .string({ required_error: 'Full name is required' })
      .min(2, 'Full name must be at least 2 characters')
      .max(100, 'Full name cannot exceed 100 characters')
      .trim(),
    phoneNumber: z
      .string()
      .regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format (e.g. +1234567890)')
      .optional()
      .nullable(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    identifier: z
      .string({ required_error: 'Email or username is required' })
      .trim(),
    password: z
      .string({ required_error: 'Password is required' }),
  }),
});

const updateProfileSchema = z.object({
  body: z.object({
    fullName: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(100, 'Full name cannot exceed 100 characters')
      .trim()
      .optional(),
    phoneNumber: z
      .string()
      .regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format')
      .optional()
      .nullable(),
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  updateProfileSchema,
};
