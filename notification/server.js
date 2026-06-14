require("dotenv").config();
const app = require("./src/app");

app.listen(3007, () => {
  console.log("Server started on port 3007");
});
