import mongoose from 'mongoose'

const connectDB = async ()=>{
    try {
        await mongoose.connect(`${process.env.MONGODB_URL}/tourgenie`)
        console.log('database is connected')
    } catch (error) {
        console.log('database connection failed', error)
    }
}

export default connectDB