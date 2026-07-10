import { Schema, model, models, type Model, type Types } from "mongoose";

export type UserRole = "consumer" | "seller" | "admin";

export interface SavedAddress {
  label?: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
}

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  /** bcrypt hash — never returned to the client (select:false). */
  passwordHash?: string;
  name?: string;
  role: UserRole;
  townId?: Types.ObjectId;
  stripeCustomerId?: string;
  emailVerified?: Date;
  image?: string;
  favorites: Types.ObjectId[]; // business ids
  followedTowns: Types.ObjectId[]; // town ids (for weekly digest)
  savedAddresses: SavedAddress[];
  notificationPrefs?: { orderUpdates: boolean; townDigest: boolean };
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<SavedAddress>(
  {
    label: String,
    name: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zip: { type: String, required: true },
    phone: String,
  },
  { _id: false },
);

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Excluded from queries by default. Only auth lookups explicitly select it.
    passwordHash: { type: String, select: false },
    name: String,
    role: { type: String, enum: ["consumer", "seller", "admin"], default: "consumer" },
    townId: { type: Schema.Types.ObjectId, ref: "Town" },
    stripeCustomerId: String,
    emailVerified: Date,
    image: String,
    favorites: [{ type: Schema.Types.ObjectId, ref: "Business" }],
    followedTowns: [{ type: Schema.Types.ObjectId, ref: "Town" }],
    savedAddresses: { type: [AddressSchema], default: [] },
    notificationPrefs: {
      orderUpdates: { type: Boolean, default: true },
      townDigest: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

export const User: Model<IUser> = models.User || model<IUser>("User", UserSchema);
