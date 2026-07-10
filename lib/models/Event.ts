import { Schema, model, models, type Model, type Types } from "mongoose";
import { EVENT_CATEGORIES, type EventCategory } from "@/lib/event-categories";

export { EVENT_CATEGORIES };
export type { EventCategory };

export interface IEvent {
  _id: Types.ObjectId;
  townId: Types.ObjectId;
  businessId?: Types.ObjectId; // null if posted by a resident
  postedBy: Types.ObjectId;
  title: string;
  description?: string;
  category: EventCategory;
  startAt: Date;
  endAt?: Date;
  locationName?: string;
  address?: { street?: string; city?: string; state?: string; zip?: string };
  imageUrl?: string;
  isFree: boolean;
  ticketUrl?: string;
  rsvpCount: number;
  rsvps: Types.ObjectId[]; // user ids who RSVP'd
  isFeatured: boolean;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    townId: { type: Schema.Types.ObjectId, ref: "Town", required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business" },
    postedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: String,
    category: { type: String, enum: [...EVENT_CATEGORIES], default: "other", index: true },
    startAt: { type: Date, required: true, index: true },
    endAt: Date,
    locationName: String,
    address: { street: String, city: String, state: String, zip: String },
    imageUrl: String,
    isFree: { type: Boolean, default: true },
    ticketUrl: String,
    rsvpCount: { type: Number, default: 0 },
    rsvps: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isFeatured: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Event: Model<IEvent> = models.Event || model<IEvent>("Event", EventSchema);
