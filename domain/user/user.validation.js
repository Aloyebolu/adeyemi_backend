import Joi from 'joi';




const signupSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().required(),
    email: Joi.string().email().lowercase().trim().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('student', 'lecturer', 'admin').default('student')
  })
});

const deleteUserSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().hex().length(24).required()
  }),
  body: Joi.object({
    role: Joi.string().valid('admin', 'lecturer', 'student'),
    model: Joi.string() // Could accept model name
  }).or('role', 'model')
});

export default {
  signup: signupSchema,
  deleteUser: deleteUserSchema
};