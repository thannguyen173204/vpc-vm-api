import mongoose from "mongoose";
const userSchema = new mongoose.Schema({
    user_name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    display_name: {
        type: String,
        required: true,
        trim: true
    },
    hashed_password: {
        type: String,
        required: true
    },
    avt_url: {
        type: String
    },
    avt_id: {
        type: String
    }
}, {
    timestamps: true
}
)
const User = mongoose.model('User', userSchema);
export default User;