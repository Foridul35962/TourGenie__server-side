import ApiErrors from "../helpers/ApiErrors.js";
import ApiResponse from "../helpers/ApiResponse.js";
import AsyncHandler from "../helpers/AsyncHandler.js";
import TripPlans from "../models/TripPlans.model.js";

export const savePlan = AsyncHandler(async (req, res) => {
    const { plans } = req.body
    const user = req.user

    if (!plans) {
        throw new ApiErrors(400, 'plans are required')
    }

    const plan = await TripPlans.create({
        user: user._id,
        plan: plans
    })

    if (!plan) {
        throw new ApiErrors(500, 'plan saved failed')
    }

    return res
        .status(201)
        .json(
            new ApiResponse(201, plan, 'plan saved successfully')
        )
})

export const deletePlan = AsyncHandler(async (req, res) => {
    const user = req.user
    const { planId } = req.params

    if (!planId) {
        throw new ApiErrors(400, 'plan id is required')
    }

    const plan = await TripPlans.findById(planId)

    if (!plan) {
        throw new ApiErrors(404, 'plan not found')
    }

    if (plan.user.toString() !== user._id.toString()) {
        throw new ApiErrors(401, 'user is not authorized')
    }

    await plan.deleteOne()

    return res
        .status(200)
        .json(
            new ApiResponse(200, planId, 'plan deleted successfully')
        )
})

export const getAllPlan = AsyncHandler(async (req, res) => {
    const user = req.user;

    const allPlans = await TripPlans.find({ user: user._id })
        .populate("user", "fullName email")
        .sort({ createdAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, allPlans, "all plan fetched successfully"));
});

export const getPlan = AsyncHandler(async (req, res) => {
    const { planId } = req.params
    const userId = req.user._id
    console.log(planId)

    if (!planId) {
        throw new ApiErrors(400, 'plan id is required')
    }

    const plan = await TripPlans.findById(planId)

    if (!plan) {
        throw new ApiErrors(404, 'plan is not found')
    }

    if (plan.user.toString() !== userId.toString()) {
        throw new ApiErrors(401, 'user is not authorized')
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, plan, 'plan fetched successfully')
        )
})