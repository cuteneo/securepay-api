const { z } = require('zod');

const transferSchema = z.object({
  body: z.object({
    recipientIdentifier: z
      .string({ required_error: 'Recipient email, username, or wallet ID is required' })
      .min(3, 'Recipient identifier must be at least 3 characters')
      .trim(),
    amount: z
      .number({ required_error: 'Amount is required' })
      .positive('Transfer amount must be strictly greater than 0')
      .max(250000, 'Single transfer cannot exceed 250,000')
      .refine((val) => Number(val.toFixed(2)) === val, {
        message: 'Amount can have at most 2 decimal places',
      }),
    note: z.string().max(255).optional(),
  }),
  headers: z.object({
    'idempotency-key': z.string().min(8, 'Idempotency-Key must be at least 8 characters').optional(),
  }).passthrough(),
});

module.exports = {
  transferSchema,
};
