require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/db/db");

connectDB();

app.listen(3001, () => {
  console.log("Product server is running on port 3001");
});
