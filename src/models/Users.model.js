import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    image: {
        url: {
            type: String
        },
        publicId: {
            type: String
        }
    },
}, { timestamps: true })

const Users = mongoose.model('Users', userSchema)

export default Users