import { Schema, model, models, type Model, type Types } from "mongoose";

export type SuggestionStatus = "pending" | "contacted" | "joined" | "declined";

export interface IBusinessSuggestion {
  _id: Types.ObjectId;
  suggestedBy?: Types.ObjectId; // nullable — anonymous submissions allowed
  townId?: Types.ObjectId;
  businessName: string;
  category?: string;
  address?: string;
  phone?: string;
  website?: string;
  notes?: string;
  searchQuery?: string; // what they searched when they hit the empty state
  status: SuggestionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSuggestionSchema = new Schema<IBusinessSuggestion>(
  {
    suggestedBy: { type: Schema.Types.ObjectId, ref: "User" },
    townId: { type: Schema.Types.ObjectId, ref: "Town" },
    businessName: { type: String, required: true },
    category: String,
    address: String,
    phone: String,
    website: String,
    notes: String,
    searchQuery: String,
    status: {
      type: String,
      enum: ["pending", "contacted", "joined", "declined"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

export const BusinessSuggestion: Model<IBusinessSuggestion> =
  models.BusinessSuggestion ||
  model<IBusinessSuggestion>("BusinessSuggestion", BusinessSuggestionSchema);
