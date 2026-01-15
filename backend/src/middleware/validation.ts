import { body, validationResult, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const validate = (validations: ValidationChain[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        res.status(400).json({ errors: errors.array() });
    };
};

// Validation rules for different endpoints
export const loginValidation = [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

export const registerValidation = [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('full_name').optional().isString(),
    body('role').optional().isIn(['admin', 'school_admin', 'viewer']),
];

export const telemetryValidation = [
    body('power_w').isFloat({ min: 0, max: 100000 }).withMessage('Invalid power value'),
    body('voltage').isFloat({ min: 0, max: 1000 }).withMessage('Invalid voltage value'),
    body('current_a').isFloat({ min: 0, max: 1000 }).withMessage('Invalid current value'),
    body('daily_kwh').optional().isFloat({ min: 0 }),
    body('total_kwh').optional().isFloat({ min: 0 }),
    body('irradiance_wm2').optional().isFloat({ min: 0 }),
    body('temp_c').optional().isFloat({ min: -50, max: 150 }),
];
