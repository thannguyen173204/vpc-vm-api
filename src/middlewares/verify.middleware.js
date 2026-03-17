import User from '../models/user.model.js'
import jwt from 'jsonwebtoken';
export const verifyToken = async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json('You are not authenticated');
    }
    const token = header.split(' ')[1];
    if (!token) return res.status(401).json('You are not authenticated');
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, duser) => {
        if (err) {
            return res.status(403).json('Token is not valid')
        };
        try {
            const user = await User.findById(duser.user_id);
            if (!user) return res.status(404).json('No user found');
            req.user = user;
            next();
        } catch (error) {
            next(error);
        }
    });
}
