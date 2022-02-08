require("dotenv-safe").config();
const express = require("express");
const router = require("./src/routes/router");
const app = express();
var cors = require('cors');
const admin = require('firebase-admin');
var md5 = require('md5');
var secretRoomInfo = {};


//#region Firestore Config
const serviceAccount = {
	type: "service_account",
	project_id: process.env.FIREBASE_KEY_project_id,
	private_key_id: process.env.FIREBASE_KEY_private_key_id,
	private_key: process.env.FIREBASE_KEY_private_key.replace(/\\n/g, '\n'),
	client_email: process.env.FIREBASE_KEY_client_email,
	client_id: process.env.FIREBASE_KEY_client_id,
	auth_uri: "https://accounts.google.com/o/oauth2/auth",
	token_uri: "https://oauth2.googleapis.com/token",
	auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
	client_x509_cert_url: process.env.FIREBASE_KEY_client_x509_cert_url
};
const { firestore } = require("firebase-admin");
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
//#endregion

//#region Firestore Objects Keeper
var users = [];
db.collection('users').onSnapshot(snapshot => {
	try {
		var change = snapshot.docChanges()[0];
		if (change.type == 'modified') {
			const modifiedUser = { ...change.doc.data(), id: change.doc.id };
			const roomsToModify = rooms.filter(r => r.users.find(u => u.hash == md5(modifiedUser.id)) || r.messages.find(m => m.userHash == md5(modifiedUser.id)));

			roomsToModify.forEach(r => {
				const modifiedRoomUsers = r.users.map(u => {
					if (u.hash == md5(modifiedUser.id)) {
						return {
							...u,
							name: modifiedUser.name,
							imgUrl: modifiedUser.imgUrl
						}
					}
					return u;
				})
				const modifiedRoomMessages = r.messages.map(m => {
					if (m.userHash == md5(modifiedUser.id)) {
						return {
							...m,
							userName: modifiedUser.name,
							userImgUrl: modifiedUser.imgUrl
						}
					}
					return m;
				})
				db.collection('rooms').doc(r.id).update({
					users: modifiedRoomUsers,
					messages: modifiedRoomMessages
				})
			})
		}
		users = snapshot.docs.map(doc => {
			return { id: doc.id, ...doc.data() };
		})
	}
	catch (ex) {
		logError('Firestore Object Keeper', ex)
		console.error(ex)
	}
});
var rooms = [];
db.collection('rooms').onSnapshot(snapshot => {
	rooms = snapshot.docs.map(doc => {
		return { id: doc.id, ...doc.data() };
	})
});
var pt_BR_words = [];
db.collection('pt_BR_words').onSnapshot(snapshot => {
	pt_BR_words = snapshot.docs.map(doc => {
		return { id: doc.id, ...doc.data() };
	})
		.sort((a, b) => Math.random() > 0.5 ? -1 : 1)
		.sort((a, b) => a.views - b.views)
});
//#endregion

//#region Express API
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(router);
app.post('/room/start', async (req, res) => {
	try {
		const { roomId, userId } = req.body;

		if (!roomId || !userId) return res.status(400).json({ msg: 'roomId and userId needed', error: true });

		var room = rooms.find(r => r.id == roomId);
		if (!room) return res.status(400).json({ msg: 'room not found', error: true });

		if (room.users[0].hash != md5(userId)) return res.status(400).json({ msg: 'you are not the host', error: true });

		if (room.users.length <= 1) return res.status(400).json({ msg: 'cant start with 1 player', error: true });

		secretRoomInfo[room.id] = {};

		var usersUpdated = room.users.map(u => {
			return {
				...u,
				votedUserName: ''
			}
		})
		await db.collection('rooms').doc(roomId).update({
			step: 1,
			stepEndAt: new Date(new Date().getTime() + (1000 * room.maxTimeStep1)),
			round: 1,
			word: getRandomWord(),
			users: usersUpdated
		})
		res.json({ msg: 'ok', error: false })
	}
	catch (ex) {
		logError('/room/start', ex)
		res.status(500).json({ msg: "Erro no servidor", error: true });
	};
})
app.post('/room/enter', (req, res) => {
	try {

		const { roomId, userId } = req.body;

		if (!roomId || !userId) return res.status(400).json({ msg: 'missing user or room' });

		const user = users.find(u => u.id == userId);
		if (!user) return res.status(400).json({ msg: 'Usuário não encontrado' });

		const room = rooms.find(r => r.id == roomId);
		if (!room) return res.status(400).json({ msg: 'Sala não encontrada' });

		if (room.users.find(u => u.hash == md5(userId))) return res.json({ msg: 'Usuário já está dentro da sala' });

		db.collection('rooms').doc(roomId).update({
			users: firestore.FieldValue.arrayUnion({
				hash: md5(userId),
				name: user.name,
				imgUrl: user.imgUrl,
				lastMoveAt: new Date(),
				score: 0,
				inactive: false
			})
		});

		return res.json({ msg: 'Usuario adicionado' })
	}
	catch (ex) {
		logError('/room/enter', ex)
		return res.status(500).json({ msg: 'Erro no servidor' });
	}
})
app.post('/room/leave', (req, res) => {
	try {
		const { roomId, userId } = req.body;

		if (!roomId || !userId) return res.status(400).json({ msg: 'Faltando sala ou usuario' });

		const user = users.find(u => u.id == userId);
		if (!user) return res.status(400).json({ msg: 'Usuário não encontrado' });

		const room = rooms.find(r => r.id == roomId);
		if (!room) return res.status(400).json({ msg: 'Sala não encontrada' });

		if (!room.users.find(u => u.hash == md5(userId))) return res.json({ msg: 'Usuário não está na sala' });

		var usersModified = room.users.filter(u => u.hash != md5(userId))

		db.collection('rooms').doc(roomId).update({ users: usersModified });

		return res.json({ msg: 'Usuario Removido' })
	} catch (ex) {
		logError('/room/leave', ex)
		return res.status(500).json({ msg: 'Erro no servidor' });
	}
})
app.post('/keep-active', (req, res) => {
	try {
		const { roomId, userId } = req.body;

		if (!roomId || !userId) return res.status(400).json({ msg: 'Faltando usuario ou sala' });

		const user = users.find(u => u.id == userId);
		if (!user) return res.status(400).json({ msg: 'user not found' });

		const room = rooms.find(r => r.id == roomId);
		if (!room) return res.status(400).json({ msg: 'room not found' });

		var userIndex = room.users.findIndex(u => u.hash == md5(userId));
		if (userIndex == -1) return res.json({ msg: 'user is not in this room' });

		room.users[userIndex].lastMoveAt = firestore.Timestamp.now();
		room.users[userIndex].inactive = false;

		db.collection('rooms').doc(roomId).update({
			users: room.users
		});

		return res.json({ msg: 'user updated' })
	} catch (ex) {
		logError('/keep-active', ex)
		return res.status(500).json({ msg: 'Erro no servidor' });
	}
})
app.post('/room/chat/message', (req, res) => {
	try {
		const { roomId, userId, text } = req.body;

		keepActive(roomId, userId);

		if (!roomId || !userId || !text) return res.status(400).json({ msg: 'missing user, room or text' });

		const user = users.find(u => u.id == userId);
		if (!user) return res.status(400).json({ msg: 'user not found' });

		const room = rooms.find(r => r.id == roomId);
		if (!room) return res.status(400).json({ msg: 'room not found' });

		var userInRoom = room.users.find(u => u.hash == md5(userId));
		if (!userInRoom) return res.status(400).json({ msg: 'user is not in this room' });

		var repWords = [{ bad: '(idiota|burro|desgracado|desgraçado|maldito|retardado)', good: 'néscio' }, { bad: 'burra|desgraçada|desgracada|maldita|retardada', good: 'néscia' }, { bad: '(puta|pulta)', good: 'meretriz' }, { bad: '(merda|bosta)', good: 'fezes' }, { bad: 'foder', good: 'danar' }, { bad: 'fode', good: 'dana' }, { bad: 'foda', good: 'dane' }, { bad: '(cu|cú|cuzão|cuzao)', good: 'orifício' }, { bad: '(caralho|karalho|caaaralho|porra|poha|cacete)', good: 'caramba' }, { bad: '(viado|gay|bicha|bixa|boiola)', good: 'homossexual' }, { bad: 'buceta', good: 'vagina' }, { bad: '(putz|pultz|piltz|patz)', good: 'fillds' }]
		var improvedText = text
		for (let w of repWords) improvedText = improvedText.replace(new RegExp(`(?<=^|\\W)${w.bad}(?=$|\\W)`, 'gmi'), w.good)

		db.collection('rooms').doc(roomId).update({
			messages: firestore.FieldValue.arrayUnion({
				userHash: md5(userId),
				userName: user.name,
				userImgUrl: user.imgUrl,
				text: improvedText,
				sentAt: firestore.Timestamp.now()
			})
		})

		return res.json({ msg: 'message sent' })
	} catch (ex) {
		logError('/room/chat/message', ex)
		return res.status(500).json({ msg: 'Erro no servidor' });
	}
})
app.post('/room/definition', (req, res) => {
	try {
		const { roomId, userId, text } = req.body;

		keepActive(roomId, userId);

		if (!roomId || !userId) return res.status(400).json({ msg: 'missing user or room' });

		if (text.length > 240) return res.status(400).json({ msg: 'Definição muito grande!' });

		const user = users.find(u => u.id == userId);
		if (!user) return res.status(400).json({ msg: 'user not found' });

		const room = rooms.find(r => r.id == roomId);
		if (!room) return res.status(400).json({ msg: 'room not found' });

		var userInRoom = room.users.find(u => u.hash == md5(userId));
		if (!userInRoom) return res.status(400).json({ msg: 'user is not in this room' });

		if (!secretRoomInfo[roomId]) secretRoomInfo[roomId] = {};

		if (!secretRoomInfo[roomId].definitions) secretRoomInfo[roomId].definitions = [];
		if (!secretRoomInfo[roomId].votes) secretRoomInfo[roomId].votes = [];

		if (secretRoomInfo[roomId].definitions.find(d => d.userId == userId)) return res.status(400).json({ msg: 'Você já enviou uma definição!' });

		secretRoomInfo[roomId].definitions.push({
			userName: user.name,
			userImgUrl: user.imgUrl,
			userId: user.id,
			text: text
		})

		if (text == getRightWordDefinition(room.word)) {
			secretRoomInfo[roomId].votes.push({
				scoredUserId: userId,
				votedUserName: 'Definição Correta',
				voterUserId: userId,
				voterUserName: user.name,
				voterUserImgUrl: user.imgUrl,
				score: 3
			})
			return res.json({ msg: 'definition is correct!!', correctDefinition: true })
		}

		return res.json({ msg: 'definition created' })
	} catch (ex) {
		logError('/room/definition', ex)
		return res.status(500).json({ msg: 'Erro no servidor' });
	}
})
app.post('/room/vote', (req, res) => {
	try {
		const { roomId, userId, text } = req.body;

		keepActive(roomId, userId);

		if (!roomId || !userId) return res.status(400).json({ msg: 'missing user or room' });

		const user = users.find(u => u.id == userId);
		if (!user) return res.status(400).json({ msg: 'user not found' });

		const room = rooms.find(r => r.id == roomId);
		if (!room) return res.status(400).json({ msg: 'room not found' });

		var userInRoom = room.users.find(u => u.hash == md5(userId));
		if (!userInRoom) return res.status(400).json({ msg: 'user is not in this room' });

		if (!secretRoomInfo[roomId]) secretRoomInfo[roomId] = {};

		if (!secretRoomInfo[roomId].definitions) secretRoomInfo[roomId].definitions = [];

		if (!secretRoomInfo[roomId].votes) secretRoomInfo[roomId].votes = [];

		if (secretRoomInfo[roomId].votes.find(v => v.voterUserId == userId)) return res.status(400).json({ msg: 'Você já votou!' });

		if (secretRoomInfo[roomId].definitions.find(d => d.text == text && d.userId == userId)) return res.status(400).json({ msg: 'cannot vote on your self' });

		var definitionsVoted = secretRoomInfo[roomId].definitions.filter(d => d.text == text);

		if (definitionsVoted.length <= 0) return res.status(400).json({ msg: 'definition not found' });


		if (text == getRightWordDefinition(room.word)) {
			secretRoomInfo[roomId].votes.push({
				scoredUserId: userId,
				votedUserName: 'Definição Correta',
				voterUserId: userId,
				voterUserName: user.name,
				voterUserImgUrl: user.imgUrl,
				score: 1
			})
			db.collection('pt_BR_words').doc(room.word).update({ views: firestore.FieldValue.increment(1) })
		}
		else {
			definitionsVoted.forEach(d => {
				secretRoomInfo[roomId].votes.push({
					scoredUserId: d.userId,
					votedUserName: d.userName,
					voterUserId: userId,
					voterUserName: user.name,
					voterUserImgUrl: user.imgUrl,
					score: 1
				})
				db.collection('pt_BR_words').doc(room.word).update({ views: firestore.FieldValue.increment(1), mistakes: firestore.FieldValue.increment(1) })
			})
		}

		return res.json({ msg: 'voted' })
	} catch (ex) {
		logError('/room/vote', ex)
		return res.status(500).json({ msg: 'Erro no servidor' });
	}
})
app.post('/room/claim-host', (req, res) => {
	try {
		const { roomId, userId, password } = req.body;

		if (password != "123") return res.status(400).json({ msg: 'wrong password' });

		if (!roomId || !userId) return res.status(400).json({ msg: 'missing user or room ' });

		const user = users.find(u => u.id == userId);
		if (!user) return res.status(400).json({ msg: 'user not found' });

		const room = rooms.find(r => r.id == roomId);
		if (!room) return res.status(400).json({ msg: 'room not found' });

		var userInRoomIndex = room.users.findIndex(u => u.hash == md5(userId));
		if (userInRoomIndex == -1) return res.status(400).json({ msg: 'user is not in this room' });

		if (userInRoomIndex == 0) return res.status(400).json({ msg: 'already host' });

		var updatedUsers = room.users;
		var me = updatedUsers.splice(userInRoomIndex, 1);
		updatedUsers = [
			...me,
			...updatedUsers
		]

		db.collection('rooms').doc(roomId).update({ users: updatedUsers })

		return res.json({ msg: 'claimed host' })
	} catch (ex) {
		logError('/room/claim-host', ex)
		return res.status(500).json({ msg: 'Erro no servidor' });
	}
})
app.post('/room/reset', (req, res) => {
	try {
		const { roomId, userId, password } = req.body;

		if (password != "123") return res.status(400).json({ msg: 'wrong password' });

		if (!roomId || !userId) return res.status(400).json({ msg: 'missing user or room ' });

		const user = users.find(u => u.id == userId);
		if (!user) return res.status(400).json({ msg: 'user not found' });

		const room = rooms.find(r => r.id == roomId);
		if (!room) return res.status(400).json({ msg: 'room not found' });

		var userInRoomIndex = room.users.findIndex(u => u.hash == md5(userId));
		if (userInRoomIndex != 0) return res.status(400).json({ msg: 'user is not host' });

		var updatedUsers = room.users.map(u => {
			return {
				...u,
				score: 0
			}
		});

		db.collection('rooms').doc(roomId).update({ users: updatedUsers, step: 0, round: 0 })

		return res.json({ msg: 'reset ok' })
	}
	catch (ex) {
		logError('/room/reset', ex)
		return res.status(500).json({ msg: 'Erro no servidor' });
	}
})
app.put('/room', (req, res) => {
	try {
		var { id, userId, maxTimeStep1, maxTimeStep2, maxTimeStep3 } = req.body;

		if (!id || !userId) return res.status(400).json({ msg: 'missing user or room ' });

		const user = users.find(u => u.id == userId);
		if (!user) return res.status(400).json({ msg: 'user not found' });

		const room = rooms.find(r => r.id == id);
		if (!room) return res.status(400).json({ msg: 'room not found' });

		var userInRoomIndex = room.users.findIndex(u => u.hash == md5(userId));
		if (userInRoomIndex == -1) return res.status(400).json({ msg: 'user is not in this room' });

		if (userInRoomIndex != 0) return res.status(400).json({ msg: 'not host (insufficient permissions)' });

		if (maxTimeStep1 < 5 || maxTimeStep1 > 999) return res.status(400).json({ msg: 'Tempo inváido para escrever definição' });
		if (maxTimeStep2 < 5 || maxTimeStep2 > 999) return res.status(400).json({ msg: 'Tempo inváido para votar definição' });
		if (maxTimeStep3 < 5 || maxTimeStep3 > 999) return res.status(400).json({ msg: 'Tempo inváido para ver pontos' });

		db.collection('rooms').doc(id).update({ maxTimeStep1, maxTimeStep2, maxTimeStep3 })

		return res.json({ msg: 'updated' })

	}
	catch (ex) {
		logError('put /room', ex)
		return res.status(500).json({ msg: 'Erro no servidor' });
	}

})
var port = process.env.PORT || 3000;
app.listen(port, () => {
	console.log("Server is running at port ", port);
});
//#endregion

//#region Steps Routine (every second)

setInterval(() => {

	for (let room of rooms) {
		try {
			const NOT_ENOUGH_PLAYERS = room.users.length <= 1 && room.step != 0
			if (NOT_ENOUGH_PLAYERS) {
				db.collection('rooms').doc(room.id).update({
					step: 0,
					stepEndAt: null,
					round: 0
				})
			}
			if (room.step == 0) continue;

			if (!secretRoomInfo[room.id]) secretRoomInfo[room.id] = {};
			if (!secretRoomInfo[room.id].definitions) secretRoomInfo[room.id].definitions = [];
			if (!secretRoomInfo[room.id].votes) secretRoomInfo[room.id].votes = [];

			const STEP_EXPIRED = new Date().getTime() >= room.stepEndAt.toDate().getTime();
			const ALL_PLAYERS_DONE = (room.step == 1 && room.users.length <= secretRoomInfo[room.id].definitions.length)
				|| (room.step == 2 && room.users.length <= getVotersCount(room.id))

			if (!STEP_EXPIRED && !ALL_PLAYERS_DONE) continue;

			if (room.step == 0 || room.step == 3) {

				secretRoomInfo[room.id] = {};

				var usersUpdated = room.users.map(u => {
					return {
						...u,
						votedUserName: ''
					}
				})

				db.collection('rooms').doc(room.id).update({
					word: getRandomWord(),
					definitions: [],
					users: usersUpdated
				})

				secretRoomInfo[room.id].definitions = [];
				secretRoomInfo[room.id].votes = [];
				db.collection('rooms').doc(room.id).update({ definitions: [] })
			}
			else if (room.step == 1) {

				secretRoomInfo[room.id].definitions.push({ text: getRightWordDefinition(room.word), userName: 'Definição Correta', userImgUrl: '' })

				var definitions = secretRoomInfo[room.id].definitions.map(d => {
					return { text: d.text };
				}).sort((a, b) => a.text > b.text ? 1 : -1);

				db.collection('rooms').doc(room.id).update({ definitions })

			}
			else if (room.step == 2) {
				// Calcula e atualiza pontuação
				var usersUpdated = room.users;
				secretRoomInfo[room.id].votes.forEach(v => {
					const scoredUserIndex = room.users.findIndex(u => u.hash == md5(v.scoredUserId));
					usersUpdated[scoredUserIndex].score += v.score;

					const voterUserIndex = room.users.findIndex(u => u.hash == md5(v.voterUserId));
					usersUpdated[voterUserIndex].votedUserName = v.votedUserName;
				})


				db.collection('rooms').doc(room.id).update({ users: usersUpdated })

				var definitions = secretRoomInfo[room.id].definitions.map(d => {
					return { text: d.text, userName: d.userName, userImgUrl: d.userImgUrl || '' };
				}).sort((a, b) => a.text > b.text ? 1 : -1);

				db.collection('rooms').doc(room.id).update({ definitions })

			}

			var nextStep = room.step + 1;
			if (room.step == 3 && room.maxRounds > room.round) nextStep = 1;
			else if ((room.step == 3 && room.maxRounds <= room.round)) nextStep = 0;


			var nextRound = room.round
			if (nextStep == 1) nextRound++;
			else if (nextStep == 0) nextRound = 0;

			const SECONDS_TO_ADD = nextStep == 1 ? room.maxTimeStep1 : (nextStep == 2 ? room.maxTimeStep2 : room.maxTimeStep3);

			db.collection('rooms').doc(room.id).update({
				step: nextStep,
				stepEndAt: new Date(new Date().getTime() + (1000 * SECONDS_TO_ADD)),
				round: nextRound
			})
		}
		catch (ex) {
			logError('Steps Routine - Room ' + room.name, ex)
		}
	}


}, 1000);

//#endregion

//#region Inactive Users Routine (every minute)
setInterval(() => {

	for (let room of rooms) {
		try {
			const INACTIVE_TIME = new Date().getTime() - (1000 * 60 * 5);
			const KICK_TIME = INACTIVE_TIME - (1000 * 60 * 2);

			// Se a sala está vazia, é deletada
			if (room.users.length <= 0) {
				db.collection('rooms').doc(room.id).delete();
			}

			// Se user está sem mover há mais de 45 segs é considerado inativo
			var hasChanges = false;
			const modifiedRoomUsers = room.users.map(u => {

				if (u.lastMoveAt.toDate().getTime() <= INACTIVE_TIME) {
					hasChanges = true;
					return { ...u, inactive: true }
				}

				return u;
			})
			if (hasChanges) db.collection('rooms').doc(room.id).update({ users: modifiedRoomUsers });


			// Se user está sem mover há mais de 2 minutos é removido
			const filteredRoomUsers = room.users.filter(u => u.lastMoveAt.toDate().getTime() > KICK_TIME)
			if (filteredRoomUsers.length != room.users.length) db.collection('rooms').doc(room.id).update({ users: filteredRoomUsers });
		} catch (ex) {
			logError('Inactive Users Routine - Room ' + room.name, ex)
		}
	}
}, 1000 * 60 * 1)
//#endregion

//#region Common Functions
function logError(endpoint, errorObject) {
	console.error(endpoint, errorObject);
	db.collection('error_logs').doc(new Date().toISOString()).set({
		endpoint,
		errorMsg: errorObject.toString(),
		datetime: admin.firestore.Timestamp.now()
	})
}
function getRandomWord() {
	var sectionWords = pt_BR_words.slice(0, 20);
	for (let word of sectionWords) {
		if (Math.random() > 0.7) return word.id
	}
	return pt_BR_words[0].id
}
function getRightWordDefinition(wordId) {
	var word = pt_BR_words.find(w => w.id == wordId)
	if (!word) return ''
	else return word.definition
}
function keepActive(roomId, userId) {

	const user = users.find(u => u.id == userId);
	if (!user) return;

	const room = rooms.find(r => r.id == roomId);
	if (!room) return;

	var userIndex = room.users.findIndex(u => u.hash == md5(userId));
	if (userIndex == -1) return;

	room.users[userIndex].lastMoveAt = firestore.Timestamp.now();
	room.users[userIndex].inactive = false;

	db.collection('rooms').doc(roomId).update({
		users: room.users
	});
}
function getVotersCount(roomId) {
	var votersIds = [];
	secretRoomInfo[roomId].votes.forEach(v => {
		if (!votersIds.includes(v.voterUserId)) votersIds.push(v.voterUserId);
	})
	return votersIds.length;
}
//#endregion

//#region Test Script
function startPing() {
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
}
//#endregion

module.exports = app;
