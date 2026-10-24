import mongoose from 'mongoose';

const serviceDailyCapacitySchema = new mongoose.Schema(
  {
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    date: { type: String, required: true },
    orderIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ServiceOrder' }], default: [] },
  },
  { timestamps: true }
);

serviceDailyCapacitySchema.index({ serviceId: 1, date: 1 }, { unique: true });

export const ServiceDailyCapacity = mongoose.model('ServiceDailyCapacity', serviceDailyCapacitySchema);
