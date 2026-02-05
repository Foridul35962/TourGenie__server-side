import axios from "axios";
import ApiErrors from "../helpers/ApiErrors.js";
import AsyncHandler from "../helpers/AsyncHandler.js";

export const getPlacePhoto = AsyncHandler(async (req, res) => {
  const ref = req.query.ref;
  const maxwidth = req.query.maxwidth || 1200;

  if (!ref) throw new ApiErrors(400, "photo ref required");

  const url = "https://maps.googleapis.com/maps/api/place/photo";

  const r = await axios.get(url, {
    params: {
      photo_reference: ref,
      maxwidth,
      key: process.env.GOOGLE_MAPS_API_KEY,
    },
    responseType: "stream",
    timeout: 20000,
    validateStatus: () => true,
  });

  if (r.status >= 400) throw new ApiErrors(404, "photo not found");

  if (r.headers["content-type"]) res.setHeader("Content-Type", r.headers["content-type"]);
  // (optional) caching header
  res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day

  r.data.pipe(res);
});