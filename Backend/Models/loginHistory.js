const LoginHistorySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  ip: String,
  device: String,
  loggedAt: { type: Date, default: Date.now },
});

export const LoginHistory = model("LoginHistory", LoginHistorySchema);
