require("dotenv").config();
const app = require("./src/app");
const http = require("http");

const { initSocketServer } = require("./src/sockets/socket.server");

const httpserver = http.createServer(app);

initSocketServer(httpserver);

httpserver.listen(3006, () => {
  console.log("AI-buddy service is running on port 3006");
});
