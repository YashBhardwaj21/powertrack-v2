import { Request, Response, NextFunction } from 'express';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const validateUUID = (paramName: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const value = req.params[paramName] || req.query[paramName];

        if (!value) {
            // Allow missing optional UUIDs
            return next();
        }

        if (typeof value === 'string' && UUID_REGEX.test(value)) {
            return next();
        }

        return res.status(400).json({
            error: 'Invalid UUID format',
            field: paramName,
            value: value
        });
    };
};
