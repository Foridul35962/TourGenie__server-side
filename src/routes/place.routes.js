import express from 'express'
import * as placeController from '../controllers/place.controller.js'

const placeRouter = express.Router()

placeRouter.get('/photo', placeController.getPlacePhoto)

export default placeRouter