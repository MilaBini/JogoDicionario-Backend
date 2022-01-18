const express = require("express");
const timingRouter = require("./timingRouter");


const router = express.Router();

router.get("/", (req, res) => {
    res.send({ msg: "It's working", error: false });
});


router.use("/timing", timingRouter);


module.exports = router;
