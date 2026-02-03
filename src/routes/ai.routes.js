import express from 'express'
import * as aiController from '../controllers/ai.controller.js'
import protect from '../middlewares/protect.js'
import arcjetProtection from '../middlewares/arcjetCheck.js'

const aiRouter = express.Router()

/** 
 * @openapi
 * tags:
 *   - name : AI
 *     description: AI routes
 * 
 * /api/ai/searchField:
 *  post:
 *      summary: destructure field from prompt
 *      tags: [AI]
 * /api/ai/createPlan:
 *  post:
 *      summary: Create tour plan
 *      tags: [AI]
 */

aiRouter.use(arcjetProtection)

aiRouter.post('/searchField', protect, aiController.searchField)
aiRouter.post('/createPlan', protect, aiController.createPlan)

export default aiRouter