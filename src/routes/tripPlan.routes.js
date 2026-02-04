import express from 'express'
import * as tripPlanController from '../controllers/tripPlan.controller.js'
import protect from '../middlewares/protect.js'

const tripPlanRouter = express.Router()

tripPlanRouter.post('/savePlan', protect, tripPlanController.savePlan)
tripPlanRouter.delete('/deletePlan/:planId', protect, tripPlanController.deletePlan)
tripPlanRouter.get('/all-plan', protect, tripPlanController.getAllPlan)
tripPlanRouter.get('/get-plan/:planId', protect, tripPlanController.getPlan)

export default tripPlanRouter