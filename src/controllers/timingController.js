
module.exports = {
    async get(req, res) {
        try {
            res.json({ now: new Date() });
        }
        catch (error) {
            res.status(500).json({ msg: "Conection failed: " + error, error: true });
        };
    }
};
