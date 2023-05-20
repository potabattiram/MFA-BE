
const express = require("express");
const bodyParser = require('body-parser');
const uuid = require("uuid");
const speakeasy = require("speakeasy");
var QRCode = require('qrcode');
const MongoClient = require('mongodb').MongoClient;
const cors = require('cors');
const session = require('express-session');

const app = express();

app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);
  next();
});

const uri = 'mongodb+srv://rampotabatti:DtlvNLLKOAQhEIEP@RamyaSthan.rpyvgw6.mongodb.net';
let client, testCollection;
async function main() {
  client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    await client.connect();
    console.log('Connected to mongo db');
  } finally {
    // await client.close();
  }
}
main().catch(console.error);

app.use(express.json());
app.use(
  cors({
    allowedHeaders: ["authorization", "Content-Type"],
    exposedHeaders: ["authorization"],
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
  })
);
app.use(session({
  secret: 'my-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));
app.get("/api", (req, res) => {
  res.json({ message: "Welcome to the two factor authentication exmaple" })
});


app.post("/api/register", async (req, res) => {
  const id = uuid.v4();
  try {
    const temp_secret = speakeasy.generateSecret();
    const username = req.body.username;
    const password = req.body.password;
    QRCode.toDataURL(temp_secret.otpauth_url, function (err, data_url) {
      client.db('MFAAuth').collection('auth').insertOne({
        userId: id,
        secret: temp_secret,
        username: username,
        password: password
      })  
      res.json({ id, secret: temp_secret.base32, qrCode: data_url })
    });

  } catch (e) {
    console.log(e);
    res.status(500).json({ message: 'Error generating secret key' })
  }
})

app.post("/api/verify", async (req, res) => {
  const { userId, token } = req.body;
  try {                                                                                                                                     // true   //--> insert into db
    await client.db('MFAAuth').collection('auth').findOne({                                                                                 // false // --> return verified false
      userId: userId
    },
      async (err, user) => {
        if (err) { return err; }
        else if (!user) { return res.status(404).send({ message: 'Register first' }) }
        else { 
          const { base32: secret } = user.secret;
          const verified = speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token
          });
          if (verified) {
            await client.db('MFAAuth').collection('auth').updateOne({ userId: userId }, { $set: { "verified": "1" } }, { upsert: true })
            res.json({ verified: true })
          } else {
            res.json({ verified: false })
          }
        }
      })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving user' })
  };
})

app.post("/api/validate", (req, res) => {
  const { username,password } = req.body;
  try {
    client.db('MFAAuth').collection('auth').findOne({ username: username,password: password }, (err, user) => {
      if (err) {
        return res.status(500).send('Error')
      } else if (!user) { 
        return res.status(404).send('User not registered!') 
      }
      else {
        res.json(user)
        if (user) {
          res.json({ validated: true })
        } else {
          res.json({ validated: false })
        }
      }
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving user' })
  };
})

const port = 9000;

app.listen(port, () => {
  console.log(`App is running on PORT: ${port}.`);
});