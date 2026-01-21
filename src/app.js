import express from 'express'
import cors from 'cors'
import cookies from 'cookie-parser'

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(cookies())

app.use(express.json())
app.use(express.urlencoded({extended: false}))

app.get('/', (req,res)=>{
    res.send('TourGenie server is running ...')
})

export default app