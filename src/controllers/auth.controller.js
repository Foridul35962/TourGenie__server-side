import { check, validationResult } from 'express-validator'
import bcrypt from 'bcryptjs'
import AsyncHandler from "../helpers/AsyncHandler.js";
import ApiErrors from '../helpers/ApiErrors.js';
import Users from '../models/Users.model.js';
import { generateVerificationMail, sendBrevoMail } from '../config/mail.js';
import ApiResponse from '../helpers/ApiResponse.js';
import redis from '../config/redis.js';

export const registration = [
    check('fullName')
        .trim()
        .notEmpty()
        .withMessage('fullName is required'),
    check('email')
        .trim()
        .isEmail()
        .withMessage('entered a valid email'),
    check('password')
        .trim()
        .isLength({ min: 8 })
        .withMessage('password must be at least 8 characters')
        .matches(/[a-zA-Z]/)
        .withMessage('password must contain a letter')
        .matches(/[0-9]/)
        .withMessage('password must contain a number'),

    AsyncHandler(async (req, res) => {
        try {
            const {fullName, email, password} = req.body
    
            const error = validationResult(req)
            if (!error.isEmpty()) {
                throw new ApiErrors(400, 'entered wrong value', error.array())
            }
    
            const exestingUser = await Users.findOne({email})
            if (exestingUser) {
                throw new ApiErrors(400, 'user is already registed')
            }
    
            const hashedPassword = await bcrypt.hash(password, 12)
    
            const otp = Math.floor(100000 + Math.random() * 900000).toString()
            await redis.set(`register:otp:${email}`,
                JSON.stringify({
                    fullName,
                    password: hashedPassword,
                    otp
                }),
                "EX",300
            )
    
            const {subject, html} = generateVerificationMail(otp)
    
            await sendBrevoMail(email, subject, html)
    
            return res
                .status(200)
                .json(
                    new ApiResponse(200, {}, 'otp send successfully')
                )
        } catch (error) {
            console.log(error)
        }
    })
]

export const verifyRegi = AsyncHandler(async(req, res)=>{
    const {email, otp} = req.body
    if (!email || !otp) {
        throw new ApiErrors(400, 'all field are required')
    }

    const data = await redis.get(`register:otp:${email}`)
    if (!data) {
        throw new ApiErrors(400, 'otp expired')
    }

    const parsed = JSON.parse(data)
    if (parsed.otp !== String(otp)) {
        throw new ApiErrors(400, 'OTP is not matched')
    }

    await Users.create({
        fullName: parsed.fullName,
        email,
        password: parsed.password
    })

    await redis.del(`register:otp:${email}`)

    return res
        .status(201)
        .json(
            new ApiResponse(201, {}, 'user registration successfull')
        )
})