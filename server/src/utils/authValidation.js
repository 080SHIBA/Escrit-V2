import Joi from 'joi';

export const normalizedEmailSchema = Joi.string().email().trim().lowercase().required();
