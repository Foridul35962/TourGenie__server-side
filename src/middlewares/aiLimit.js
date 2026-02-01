import redis from "../config/redis.js";
import AsyncHandler from "../helpers/AsyncHandler.js";

const aiLimit = AsyncHandler(async (req, res, next) => {
    const key = "geminiLimit"
    const count = await redis.incr(key)

    if (count === 1) {
        await redis.expire(key, 60)
    }

    if (count > 10) {
        const ttl = await redis.ttl(key);
        throw new ApiErrors(
            429,
            `Gemini quota exceeded. Try again in ${ttl}s`
        );
    }

    return next()
})

export default aiLimit