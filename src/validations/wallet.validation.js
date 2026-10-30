const { z } = require('zod');

const depositSchema = z.object({
  body: z.object({
    amount: z
      .number({ required_error: 'Amount is required' })
      .positive('Deposit amount must be strictly greater than 0')
      .max(1000000, 'Single deposit cannot exceed 1,000,000')
      .refine((val) => Number(val.toFixed(2)) === val, {
        message: 'Amount can have at most 2 decimal places',
      }),
    description: z.string().max(255).optional(),
  }),
});

const withdrawSchema = z.object({
  body: z.object({
    amount: z
      .number({ required_error: 'Amount is required' })
      .positive('Withdrawal amount must be strictly greater than 0')
      .max(500000, 'Single withdrawal cannot exceed 500,000')
      .refine((val) => Number(val.toFixed(2)) === val, {
        message: 'Amount can have at most 2 decimal places',
      }),
    description: z.string().max(255).optional(),
  }),
});

module.exports = {
  depositSchema,
  withdrawSchema,
};
