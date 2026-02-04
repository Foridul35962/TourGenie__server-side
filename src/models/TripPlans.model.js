import mongoose from 'mongoose'

const tripPlanSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true,
        index: true
    },
    plan: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    }
}, { timestamps: true })

tripPlanSchema.index({ user: 1, createdAt: -1 });

const TripPlans = mongoose.model('TripPlans', tripPlanSchema)

export default TripPlans