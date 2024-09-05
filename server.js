const express = require("express");
const app = express();
const { routes } = require("./routes");
const port = 5000;

app.use((req, res, next) => {
  const origin = req.headers.origin || "*";

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH"
  );
  next();
});

app.use(express.json());
app.use(routes);

app.listen(port, () => {
  console.log(`Server running in: http://localhost:${port}`);
});
