import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const connection = await mongoose.connect(process.env.DB);

    console.log(`DB Connected: ${connection.connection.host}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};