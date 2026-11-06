import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'chess_super_secret';

export const extractUserId = (token: unknown): string | null => {
    if (typeof token !== "string" || token === "") return null;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (typeof decoded === "object" && typeof decoded.userId === "string") {
            return decoded.userId;
        }
        return null;
    } catch {
        return null;
    }
};