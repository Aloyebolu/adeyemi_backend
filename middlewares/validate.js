// middlewares/validate.js
import Joi from 'joi';

export default (schema) => {
  return (req, res, next) => {
    try {
      const { body, params, query } = req;

      // Validate body
      if (schema.body) {
        const { error } = schema.body.validate(body, { abortEarly: false });
        if (error) {
          const message = error.details.map(d => d.message).join(', ');
          return res.status(400).json({ status: 'fail', message });
        }
      }

      // Validate params
      if (schema.params) {
        const { error } = schema.params.validate(params, { abortEarly: false });
        if (error) {
          const message = error.details.map(d => d.message).join(', ');
          return res.status(400).json({ status: 'fail', message });
        }
      }

      // Validate query
      if (schema.query) {
        const { error } = schema.query.validate(query, { abortEarly: false });
        if (error) {
          const message = error.details.map(d => d.message).join(', ');
          return res.status(400).json({ status: 'fail', message });
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
