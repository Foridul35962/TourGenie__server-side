import jwt from "jsonwebtoken";
import AsyncHandler from "../helpers/AsyncHandler.js";
import ApiErrors from "../helpers/ApiErrors.js";
import Users from "../models/Users.model.js";

const protect = AsyncHandler(async (req, res, next) => {
    try {
        const { token } = req.cookies

        if (!token) {
            throw new ApiErrors(401, 'unauthorize access')
        }

        const decoded = jwt.verify(token,
            process.env.TOKEN_SECRET
        )

        if (!decoded) {
            throw new ApiErrors(400, 'token failed')
        }

        const user = await Users.findById(decoded.userId).select("-password")
        if (!user) {
            throw new ApiErrors(404, 'user not found')
        }

        req.user = user

        next()
    } catch (error) {
        throw new ApiErrors(401, 'token failed')
    }
})

export default protect