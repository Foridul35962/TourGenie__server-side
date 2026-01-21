import express from 'express'
import cors from 'cors'
import cookies from 'cookie-parser'
import swaggerUi from "swagger-ui-express";

//local import
import errorHandler from './helpers/ErrorHandler.js'
import { swaggerSpec } from './config/swagger.js';
import authRouter from './routes/auth.routes.js';
import "./config/redis.js";

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(cookies())

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

//routes
app.use('/api/auth', authRouter)


app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));


app.get('/', (req, res) => {
    res.send('TourGenie server is running ...')
})

app.use(errorHandler)

export default app