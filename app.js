// app.js
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res
    .status(200)
    .send("<h1>Welcome to the CI/CD Workshop! - Version 2.0</h1>");
});

app.get("/health", (req, res) => {
  res
    .status(200)
    .json({ status: "healthy" });
});

module.exports = app;
