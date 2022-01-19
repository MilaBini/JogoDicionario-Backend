const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = require('./token/jogo-dicionario-old.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();


db.collection('palavras').get().then(snap => {
    var words = snap.docs.map(d => {
        var betterDef = d.data().definicao.replace(/[;$:$]/, '.').trim()
        betterDef = betterDef[betterDef.length - 1].match(/[\.\?\!]/g) ? betterDef : betterDef + '.'

        var betterWord = d.id.trim()
        return { word: betterWord, definition: betterDef, views: 0, mistakes: 0 }
    })
    fs.writeFileSync('./planning/words.json', JSON.stringify(words))
})


// --------------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------------


// const serviceAccount2 = require('./token/CHANGE_IT_IF_YOU_KNOW_WHAT_YOUR_DOING.json');
// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount2)
// });
// const db2 = admin.firestore();

// var words = JSON.parse(fs.readFileSync('./planning/words.json'))

// words.forEach(w => {
//     db2.collection('pt_BR_words').doc(w.word).set(w);
// })
