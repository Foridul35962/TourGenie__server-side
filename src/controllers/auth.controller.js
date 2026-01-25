import { check, validationResult } from 'express-validator'
import bcrypt from 'bcryptjs'
import AsyncHandler from "../helpers/AsyncHandler.js";
import ApiErrors from '../helpers/ApiErrors.js';
import Users from '../models/Users.model.js';
import { generatePasswordResetMail, generateVerificationMail, sendBrevoMail } from '../config/mail.js';
import jwt from 'jsonwebtoken'
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
            const { fullName, email, password } = req.body

            const error = validationResult(req)
            if (!error.isEmpty()) {
                throw new ApiErrors(400, 'entered wrong value', error.array())
            }

            const exestingUser = await Users.findOne({ email })
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
                "EX", 300
            )

            const { subject, html } = generateVerificationMail(otp)

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

export const verifyRegi = AsyncHandler(async (req, res) => {
    const { email, otp } = req.body
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

export const login = AsyncHandler(async (req, res) => {
    const { email, password } = req.body
    if (!email || !password) {
        throw new ApiErrors(400, 'email and password are required')
    }

    const user = await Users.findOne({ email })

    if (!user) {
        throw new ApiErrors(404, 'user not registered')
    }

    const limitKey = `login:${email}`
    const count = await redis.incr(limitKey)

    if (count === 1) {
        await redis.expire(limitKey, 600)
    }
    if (count > 5) {
        throw new ApiErrors(429, 'too many requiest')
    }

    const isMatchedPass = await bcrypt.compare(password, user.password)
    if (!isMatchedPass) {
        throw new ApiErrors(400, 'password not matched')
    }

    await redis.del(limitKey)

    const token = jwt.sign(
        { userId: user._id },
        process.env.TOKEN_SECRET,
        { expiresIn: process.env.TOKEN_EXPIRY }
    )

    const tokenOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 10 * 24 * 60 * 60 * 1000
    }

    user.password = undefined

    return res
        .status(200)
        .cookie('token', token, tokenOptions)
        .json(
            new ApiResponse(200, user, 'user loggedIn successfully')
        )
})

export const logout = AsyncHandler(async (req, res) => {
    const tokenOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 10 * 24 * 60 * 60 * 1000
    }

    return res
        .status(200)
        .clearCookie('token', tokenOptions)
        .json(
            new ApiResponse(200, {}, 'user logged out successfully')
        )
})

export const forgetPass = AsyncHandler(async (req, res) => {
    const { email } = req.body
    if (!email) {
        throw new ApiErrors(400, 'email are required')
    }

    const user = await Users.findOne({ email })
    if (!user) {
        throw new ApiErrors(404, 'user are not registered')
    }

    const limitKey = `forget:${email}`
    const count = await redis.incr(limitKey)

    if (count === 1) {
        redis.expire(limitKey, 600)
    }

    if (count > 10) {
        throw new ApiErrors(429, 'too many request')
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    await redis.set(`forget:otp:${email}`,
        JSON.stringify({
            otp,
            verified: false
        }),
        "EX", 300
    )

    const { subject, html } = generatePasswordResetMail(otp)

    await sendBrevoMail(email, subject, html)

    return res
        .status(200)
        .json(
            new ApiResponse(200, 'reset otp send successfully')
        )
})

export const verifyForgetPass = AsyncHandler(async (req, res) => {
    const { email, otp } = req.body

    if (!email || !otp) {
        throw new ApiErrors(400, 'all field are required')
    }

    const count = await redis.incr(`forget:${email}`)
    if (count > 10) {
        throw new ApiErrors(429, 'too many request')
    }

    const otpKey = await redis.get(`forget:otp:${email}`)

    if (!otpKey) {
        throw new ApiErrors(400, 'otp is expired')
    }
    const data = JSON.parse(otpKey)

    if (data.otp !== otp) {
        throw new ApiErrors(400, 'otp is not matched')
    }

    data.verified = true

    await redis.del(`forget:${email}`)
    await redis.set(`forget:otp:${email}`,
        JSON.stringify(data),
        "EX", 300
    )

    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, 'user verified successfully')
        )
})

export const resetPass = [
    check('password')
        .trim()
        .isLength({ min: 8 })
        .withMessage('password must be at least 8 characters')
        .matches(/[a-zA-Z]/)
        .withMessage('password must contain a letter')
        .matches(/[0-9]/)
        .withMessage('password must contain a number'),

    AsyncHandler(async (req, res) => {
        const { email, password } = req.body
        const error = validationResult(req)

        if (!error.isEmpty()) {
            throw new ApiErrors(400, 'entered wrong value', error.array())
        }

        const temp = await redis.get(`forget:otp:${email}`)

        if (!temp) {
            throw new ApiErrors(400, 'time expired')
        }

        const data = JSON.parse(temp)

        if (!data.verified) {
            throw new ApiErrors(401, 'user not verified')
        }

        await redis.del(`forget:otp:${email}`)

        const hashedPassword = await bcrypt.hash(password, 12)

        await Users.findOneAndUpdate({ email },
            { password: hashedPassword }
        )

        return res
            .status(200)
            .json(
                new ApiResponse(200, {}, 'password reset successfully')
            )
    })
]

export const resendOtp = AsyncHandler(async (req, res) => {
    const { email, type } = req.body

    if (!email) {
        throw new ApiErrors(400, 'email are required')
    }
    if (!type || !['register', 'forgetPass'].includes(type)) {
        throw new ApiErrors(400, 'type must be register or forgetPass')
    }

    // cooldown 60 sec
    const cooldownKey = `otp:cooldown:${type}:${email}`
    const inCooldown = await redis.get(cooldownKey)

    if (inCooldown) {
        const ttl = await redis.ttl(cooldownKey)
        throw new ApiErrors(429, `please wait ${ttl}s before resending OTP`)
    }

    // rate limit
    const limitKey = `otp:rate:${type}:${email}`
    const count = await redis.incr(limitKey)
    if (count === 1) {
        await redis.expire(limitKey, 600)
    }
    if (count > 5) {
        throw new ApiErrors(429, 'too many request')
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    if (type === 'register') {
        const existingUser = await Users.findOne({ email })
        if (existingUser) {
            throw new ApiErrors(400, 'user is already registered')
        }

        const raw = await redis.get(`register:otp:${email}`)
        if (!raw) {
            throw new ApiErrors(400, 'otp expired or no pending registration found. Please register again')
        }

        const data = JSON.parse(raw)
        await redis.set(`register:otp:${email}`,
            JSON.stringify({ ...data, otp }),
            "EX", 300
        )

        const { subject, html } = generateVerificationMail(otp)
        await sendBrevoMail(email, subject, html)
    }
    else if (type === 'forgetPass') {
        const user = await Users.findOne({ email })
        if (!user) {
            throw new ApiErrors(400, 'user is not registered')
        }

        await redis.set(`forget:otp:${email}`,
            JSON.stringify({ otp, verified: false }),
            "EX", 300
        )

        const { subject, html } = generatePasswordResetMail(otp)
        await sendBrevoMail(email, subject, html)
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, 'otp resended')
        )
})