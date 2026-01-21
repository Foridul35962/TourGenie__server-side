import express from 'express'
import * as authController from '../controllers/auth.controller.js'

const authRouter = express.Router()
/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Authentication routes
 *
 * /api/auth/register:
 *   post:
 *     summary: Register user
 *     tags: [Auth]
 *
 * /api/auth/verify-regi:
 *   post:
 *     summary: Verify registration OTP
 *     tags: [Auth]
 *
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *
 * /api/auth/logout:
 *   get:
 *     summary: Logout user
 *     tags: [Auth]
 *
 * /api/auth/forget-pass:
 *   post:
 *     summary: Send password reset OTP
 *     tags: [Auth]
 *
 * /api/auth/verify-pass:
 *   post:
 *     summary: Verify password reset OTP
 *     tags: [Auth]
 *
 * /api/auth/reset-pass:
 *   patch:
 *     summary: Reset password
 *     tags: [Auth]
 *
 * /api/auth/get-user:
 *   get:
 *     summary: Get logged-in user
 *     tags: [Auth]
 *
 * /api/auth/update-location:
 *   post:
 *     summary: Update user location
 *     tags: [Auth]
 */


authRouter.post('/register', authController.registration)
authRouter.post('/verify-regi', authController.verifyRegi)

export default authRouter