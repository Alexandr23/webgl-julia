import express from "express";

const PORT = 80;

const app = express();

app.use(express.static("dist"));

app.get("/bonus", (req, res) => {
  res.sendFile("/bonus/index.html");
});

app.get("/", (req, res) => {
  res.send("Happy Birthday!");
});

app.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));
