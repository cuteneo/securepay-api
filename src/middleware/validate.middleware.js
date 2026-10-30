const { ZodError } = require('zod');
const { UnprocessableEntityError } = require('../utils/errors');

const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers,
    });

    if (parsed.body) req.body = parsed.body;
    if (parsed.query) req.query = parsed.query;
    if (parsed.params) req.params = parsed.params;

    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors = error.errors.map((err) => ({
        field: err.path.slice(1).join('.'),
        message: err.message,
      }));
      return next(new UnprocessableEntityError('Validation failed', formattedErrors));
    }
    next(error);
  }
};

module.exports = validate;
