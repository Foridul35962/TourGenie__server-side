import dotenv from 'dotenv'
dotenv.config()
import app from './src/app.js'
import connectDB from './src/config/db.js'
import { startServer } from './src/config/redis.js'

const PORT = process.env.PORT || 5000
const connection = async () => {
    await connectDB()
    await startServer()
    app.listen(PORT, () => {
        console.log(`server is started at http://localhost:${PORT}`)
    })
}

connection().catch((err) => {
    console.log('server start error', err)
})