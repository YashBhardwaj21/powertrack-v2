import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) =>
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Parse body, params, query? Usually just body for POST.
            // For rigorousness, we could validate all, but req.body is the standard for 'validate(schema)'.
            // Note: parseAsync allows for async refinements if needed.
            req.body = await schema.parseAsync(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.format()
                });
            }
            return res.status(500).json({ error: 'Internal validation error' });
        }
    };
