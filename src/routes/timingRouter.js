const express = require("express");
const userRouter = express.Router();
const timingController = require("../controllers/timingController");

userRouter.get("/", timingController.get);


module.exports = userRouter;
