import genAI from "../config/gemini.js";
import crypto from "crypto";
import ApiErrors from "../helpers/ApiErrors.js";
import ApiResponse from "../helpers/ApiResponse.js";
import AsyncHandler from "../helpers/AsyncHandler.js";
import redis from "../config/redis.js";


const normalizePrompt = (p) => p.trim().replace(/\s+/g, " ").toLowerCase();
const hashKey = (s) => crypto.createHash("sha256").update(s).digest("hex");


export const searchField = AsyncHandler(async (req, res) => {
    const { prompt } = req.body
    if (!prompt) {
        throw new ApiErrors(400, 'prompt is required')
    }

    //check redis
    const normalized = normalizePrompt(prompt);
    const cacheKey = `ai:searchField:v1:${hashKey(normalized)}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
        const data = JSON.parse(cached);
        return res
            .status(200)
            .json(new ApiResponse(200, data, "field search successfully (cache)"));
    }

    //set limit
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

    //call gemini
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        systemInstruction: `
            You are an information extraction engine for a travel planning app.
            Your job: extract structured fields from a user's prompt and return ONLY valid JSON.

            Output rules:
            - Return ONLY JSON. No markdown, no explanation, no extra text.
            - JSON must match the schema exactly (same keys).
            - If a field is not mentioned or cannot be inferred, return null for that field.
            - Always include originalPrompt exactly as provided.
            - Do not hallucinate values (no guessing).
            - Numbers must be returned as numbers (not strings).

            Schema (keys must be exactly these):
            {
            "origin": string|null,
            "destination": string|null,
            "budgetType": "cheap"|"mid"|"luxury"|null,
            "members": number|null,
            "days": number|null,
            "originalPrompt": string
            }

            Extraction guidelines:
            - origin & destination:
            - If prompt clearly indicates a route, extract BOTH:
                - Examples:
                - "Dhaka to Cox's Bazar" => origin="Dhaka", destination="Cox's Bazar"
                - "from Dhaka to Tangail" => origin="Dhaka", destination="Tangail"
                - "go to Tangail from Dhaka" => origin="Dhaka", destination="Tangail"
            - If only one place is mentioned (single destination trip):
                - Set destination to that place, origin=null
            - Keep casing and punctuation reasonably close to user text (normalize minor spacing only).
            - Do NOT combine them into one string.

            - budgetType:
            - Map synonyms:
                - cheap / low / low budget / budget / economy => "cheap"
                - mid / moderate / medium / standard => "mid"
                - rich / luxury / premium / high budget => "luxury"
            - If multiple appear, choose the strongest (luxury > mid > cheap) based on context.

            - members:
            - If user mentions number of people: "2 people", "we are 3", "for 5 persons", extract as number.
            - If not stated, null.

            - days:
            - If user mentions duration like "in 3 days", "for 5 days", "3-day trip", extract number of days as a number.
            - If user gives nights only (e.g., "2 nights") and days not mentioned, keep days = null (do not convert).
            - If multiple durations appear, choose the most explicit day count.

            - Do not add any additional keys.
        `
    })

    const userPrompt = `
        Extract travel fields from this prompt and output JSON only.

        User prompt:
        """${prompt}"""

        Return ONLY JSON matching the schema.
        Missing fields must be null.
        Always include originalPrompt exactly.
    `

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            },
        });
        const response = await result.response;

        const reply = JSON.parse(response.text());

        //save to redis
        await redis.set(cacheKey, JSON.stringify(reply), "EX", 60 * 60 * 24);

        return res
            .status(200)
            .json(
                new ApiResponse(200, reply, 'field search successfully')
            )
    } catch (error) {
        throw new ApiErrors(500, error.message)
    }
})

const normalize = (v) =>
    String(v ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();

// cacheKey now uses origin + destination
const makeCacheKey = ({ origin, destination, budget, members, days, prompt }) => {
    const base = [
        normalize(origin),
        normalize(destination),
        normalize(budget),
        Number(members),
        Number(days),
        normalize(prompt),
    ].join("|");

    return (
        "ai:createPlan:v2:" +
        crypto.createHash("sha256").update(base).digest("hex")
    );
};

export const createPlan = AsyncHandler(async (req, res) => {
    const { origin, destination, budget, members, days, prompt } = req.body;

    if (
        origin == null ||
        destination == null ||
        budget == null ||
        members == null ||
        days == null ||
        prompt == null
    ) {
        throw new ApiErrors(400, "all field are required");
    }

    // route string for prompt
    const route = `${origin} to ${destination}`;

    // redis cache check
    const cacheKey = makeCacheKey({ origin, destination, budget, members, days, prompt });
    const cached = await redis.get(cacheKey);

    if (cached) {
        return res.status(200).json(
            new ApiResponse(200, JSON.parse(cached), "trip plan successfully (cache)")
        );
    }

    // global Gemini per-minute limit
    const key = "geminiLimit";
    const count = await redis.incr(key);

    if (count === 1) {
        await redis.expire(key, 60);
    }

    if (count > 10) {
        const ttl = await redis.ttl(key);
        throw new ApiErrors(429, `Gemini quota exceeded. Try again in ${ttl}s`);
    }

    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        systemInstruction: `
            You are a professional Tour Guide.

            When a user provides a route like "Origin to Destination", your plan MUST include:
            1. Transportation: Best way to travel from origin to destination (Bus/Train/Flight) with estimated costs.
            2. Accommodation: Hotel suggestions at the destination with types and costs.
            3. Daily Itinerary: EXACTLY one itinerary entry per day.
            4. Food: Famous local dishes and restaurant recommendations.
            5. Budget Breakdown: Itemized estimation including transport, stay, food, and local travel.

            CRITICAL RULES:
            - The trip duration is exactly ${days} days.
            - dailyItinerary array MUST contain exactly ${days} objects.
            - Day numbering must start from 1 and end at ${days}.
            - Costs must be realistic for Bangladesh context unless origin/destination imply otherwise.
            - Return ONLY valid JSON. No markdown, no explanations.

            Strict JSON format (keys must match exactly):
            {
            "success": true,
            "plan": {
                "tripName": "",
                "totalMembers": 0,
                "budget": "",
                "origin": "",
                "destination": "",
                "days": 0,
                "prompt": { "transport": "", "pace": "" },
                "transportation": { "mode": "", "details": "", "estimatedCost": "" },
                "accommodation": [
                { "hotelName": "", "type": "", "description": "", "estimatedCostPerNight": "" }
                ],
                "dailyItinerary": [
                { "day": 1, "activities": [] }
                ],
                "food": {
                "famousLocalDishes": [],
                "recommendations": ""
                },
                "budgetBreakdown": {
                "transportation": { "description": "", "estimatedCost": "" },
                "accommodation": { "description": "", "estimatedCost": "" },
                "localTransportation": { "description": "", "estimatedCost": "" },
                "foodAndBeverages": { "description": "", "estimatedCost": "" },
                "activitiesAndEntryFees": { "description": "", "estimatedCost": "" },
                "totalEstimatedCost": "",
                "notes": ""
                }
            }
            }
        `
    });

    const userPrompt = `
        Plan a trip with these details:
        - Origin: ${origin}
        - Destination: ${destination}
        - Route: ${route}
        - Budget category: ${budget}
        - Travelers: ${members}
        - Duration: ${days} days
        - User's Specific Request: ${prompt}

        Important:
        - Create EXACTLY ${days} daily itinerary items.
        - Costs must reflect total for ${members} travelers.
    `;

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: { responseMimeType: "application/json" },
        });

        const reply = JSON.parse(result.response.text());

        // cache set
        await redis.set(cacheKey, JSON.stringify(reply), "EX", 60 * 60 * 24);

        return res.status(200).json(new ApiResponse(200, reply, "trip plan successfully"));
    } catch (error) {
        throw new ApiErrors(500, error?.message || "Trip plan generation failed");
    }
});