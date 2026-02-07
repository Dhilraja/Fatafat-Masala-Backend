const app = require("./Backend/app");
const http = require("http");
require("dotenv").config();

const port = process.env.PORT || 3000;
app.set("port", port);
const server = http.createServer(app);
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
