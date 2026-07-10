import { Schema, model, models, type Model, type Types } from "mongoose";

export type ExitType = "amazon" | "suggest" | "adjacent_town" | "bounced";

/**
 * Every time a search yields no local results and the user exits, we log it.
 * This powers /admin/gaps: "23 searches for 'candles' in Royal went to Amazon"
 * — turning unmet demand into a business-recruitment lead list.
 */
export interface ISearchExit {
  _id: Types.ObjectId;
  townId?: Types.ObjectId;
  searchQuery: string;
  category?: string;
  exitType: ExitType;
  createdAt: Date;
}

const SearchExitSchema = new Schema<ISearchExit>(
  {
    townId: { type: Schema.Types.ObjectId, ref: "Town", index: true },
    searchQuery: { type: String, required: true },
    category: String,
    exitType: { type: String, enum: ["amazon", "suggest", "adjacent_town", "bounced"] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const SearchExit: Model<ISearchExit> =
  models.SearchExit || model<ISearchExit>("SearchExit", SearchExitSchema);
