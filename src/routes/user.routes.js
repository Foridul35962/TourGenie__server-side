import express from 'express'
import * as userController from '../controllers/user.controller.js'
import protect from '../middlewares/protect.js'


/** 
 * @openapi
 * tags:
 *   - name : User
 *     description: User routes
 * 
 * /api/user/user:
 *  get:
 *      summary: fetch user
 *      tags: [User]
 */

const userRouter = express.Router()

userRouter.get('/user', protect, userController.getUser)

export default userRouter