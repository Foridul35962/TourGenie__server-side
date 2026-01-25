import ApiErrors from "../helpers/ApiErrors.js";
import ApiResponse from "../helpers/ApiResponse.js";
import AsyncHandler from "../helpers/AsyncHandler.js";

export const getUser = AsyncHandler(async (req, res) => {
    const user = req.user
    if (!user) {
        throw new ApiErrors(404, 'user not found')
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, user, 'user fatched successfully')
        )
})