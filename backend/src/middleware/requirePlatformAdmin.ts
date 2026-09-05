import { Request, Response, NextFunction } from 'express';

export const requirePlatformAdmin = (req: Request, res: Response, next: NextFunction) => {
  // 1. Verify that a user is authenticated
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Unauthorized: Please log in first.' });
  }

  // 2. Retrieve the authenticated user identity and cast safely
  const user = req.user as any;

  // 3. Verify isPlatformAdmin === true
  if (user.isPlatformAdmin === true) {
    // 4. Allow access only when true
    return next();
  }

  // 5. Reject everyone else
  return res.status(403).json({ error: 'Forbidden: Platform Administrator access required.' });
};
