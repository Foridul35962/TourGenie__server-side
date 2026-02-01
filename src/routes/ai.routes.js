import express from 'express'
import * as aiController from '../controllers/ai.controller.js'
import protect from '../middlewares/protect.js'
import arcjetProtection from '../middlewares/arcjetCheck.js'
import aiLimit from '../middlewares/aiLimit.js'

const aiRouter = express.Router()

aiRouter.use(arcjetProtection)
aiRouter.post('/searchField', protect, aiLimit, aiController.searchField)
aiRouter.post('/createPlan', protect, aiLimit, aiController.createPlan)

export default aiRouter