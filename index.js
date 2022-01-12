require("dotenv-safe").config();
const express = require("express");
const router = require("./src/routes/router");
const app = express();
var cors = require('cors');
const admin = require('firebase-admin');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(router);

var port = process.env.PORT || process.env.SYSTEM_PORT;
app.listen(port, () => {
	console.log("Server is running at port ", port);
});

const serviceAccount = require('./jogo-dicionario-firebase-adminsdk-a4gm6-5a9e5f8b5b.json');
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

var jaPingou = false;
setInterval(() => {
	var date = new Date();
	var horaDePingar = date.getMinutes() % 10 == 0;
	if (horaDePingar && !jaPingou) {
		jaPingou = true;
		db.collection('testing').doc('testing').update({
			pings: admin.firestore.FieldValue.arrayUnion(admin.firestore.Timestamp.now())
		})
	}
	else if (!horaDePingar) {
		jaPingou = false;
	}
}, 1000);

module.exports = app;
