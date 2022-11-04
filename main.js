/* The `dotenv` package allows us to load environnement
 * variables from the `.env` file. Then, we can access them
 * with `process.env.ENV_VAR_NAME`.
 */
require("dotenv").config();

const express = require("express");
const http = require("http");
const htmlDocx = require("html-docx-js")
const ejs = require("ejs"); // template engine
const multer = require("multer"); // handle file upload
const fs = require("fs"); // access to the server's file system.
const { Deepgram } = require('@deepgram/sdk');
const { json } = require("body-parser");
const mysql = require("mysql")
const bcrypt = require("bcrypt")
const bodyParser = require('body-parser');
const { request } = require("express");
const session = require('express-session');
const app = express();


// enable body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));




app.use(bodyParser.urlencoded({
  extended: true
}));


app.get("/login", (req, res) => {
	res.render('index.ejs');
});



app.get('/signup', (req, res) => {

	res.render('signup.ejs');
  
  });


// // database authantication for Login and Signup


const DB_HOST = 'localhost'
const DB_USER = 'root'
const DB_PASSWORD = ''
const DB_DATABASE = 'Deep_Gram'
const DB_PORT = 3306


const db = mysql.createPool({
   connectionLimit: 100,
   host: DB_HOST,
   user: DB_USER,
   password: DB_PASSWORD,
   database: DB_DATABASE,
   port: DB_PORT
})
var connection
 db.getConnection( (err, connection)=> {
  if (err) throw (err)
  console.log ("DB connected successful: " + connection.threadId)
  connection = connection
})
app.use(express.json())

//CREATE USER
app.post("/signup", async (req,res) => {

  const user = req.body.name;
  const email = req.body.email;
  const hashedPassword =req.body.password;

  db.getConnection( async (err, connection) => {
   if (err) throw (err)
   const sqlSearch = "SELECT * FROM userTable WHERE user = ?"
   const search_query = mysql.format(sqlSearch,[user])
  console.log(user , email , hashedPassword)

   const sqlInsert = "INSERT INTO userTable VALUES (0,?,?,?)"
  console.log(user , email , hashedPassword , sqlInsert)

   const insert_query = mysql.format(sqlInsert,[user , email , hashedPassword])
   console.log(insert_query)
   connection.query (search_query, async (err, result) => {
    if (err) throw (err)
    console.log("------> Search Results")
    console.log(result.length)
    if (result.length != 0) {
      res.redirect('/signup')
       res.sendStatus(409) 
    } 
    else {
    connection.query (insert_query, (err, result)=> {
     if (err) throw (err)
      res.redirect('/login')
    })
   }
  }) //end of connection.query()
  }) //end of db.getConnection()
  })

// LOGIN (AUTHENTICATE USER)
app.post("/login", (req, res)=> {

  const email = req.body.email
  const password = req.body.password

  db.getConnection( async (err, connection) => {
    if (err) throw (err)
   const sqlSearch = "Select * from userTable where email = ?"
   const search_query = mysql.format(sqlSearch,[email])
   connection.query (search_query, async (err, result) => {
    if (err) throw (err)
    if (result.length == 0) {
      res.redirect('/signup')
    } 
    else {
       const hashedPassword = result[0].password
      //  get the hashedPassword from result
      if (password, hashedPassword) {
      console.log("---------> Login Successful")
      req.session.login = true
      req.session.email = email
      res.redirect('/')
      } 
      else {

      res.redirect('/login')
      } //end of bcrypt.compare()
    }//end of User exists i.e. results.length==0
   }) //end of connection.query()
  })
  }) //end of app.post()


















// after login and signup

const DG_KEY = process.env.DG_KEY;

if (DG_KEY === undefined) {
  throw "You must define DG_KEY in your .env file";
}

app.set("view engine", "ejs"); // initialize "ejs" template engine
let server = http.createServer(app);

// We use `/tmp` to store the file sent by users because there are no size
// limit on Glitch in this directory. On Glitch, those files will be removed
// at every application restart. You might want using another folder and cleaning
// strategy for a real app.
const UPLOAD_DIST = "/tmp/uploaded/";
const upload = multer({ dest: UPLOAD_DIST }); // initialize file upload handling
if (!fs.existsSync(UPLOAD_DIST)) {
  // if the upload destination folder doesn't exist
  fs.mkdirSync(UPLOAD_DIST); // ... create it!
}

// We expose the uploaded files so we can play them on the `analytics.ejs` result
// page.
app.get("/uploaded-file/:filename", (req, res) => {
  const filename = req.params.filename;
  // Prevent accessing another folder than `UPLOAD_DIST`.
  if (filename.indexOf("/") !== -1) {
    res.status(400).send("You cannot access this resource.");
  }
  const completePath = UPLOAD_DIST + filename;
  if (!fs.existsSync(completePath)) {
    res.status(404).send("This resource doesn't exist");
  } else {
    res.sendFile(completePath);
  }
});

/*
 * Basic configuration:
 * - we expose the `/public` folder as a "static" folder, so
 *   browser can directly request js and css files in it.
 * - we send the `/public/index.html` file when the browser requests
 *   the "/" route.
 */
app.use(express.static(__dirname + "/public"));
app.get("/", (req, res) => {
  if(req.session.login==true){
  res.render("audiosubmit.ejs");
  }
  else{
    res.redirect('/login')
  }
});

/**
 * Request ASR from Deepgram server.
 * If `contentType == "application/json"`, Deepgram API expects the `payload` to
 * be something like: `{ url: "https://myurl.com/myaudiofile.mp3" }`. The url has to point
 * to an audio file.
 *
 * If `contentType` is NOT "application/json", Deepgram server expects the payload to
 * be raw binary audio file.
 *
 * @param {{
 *   res: import("express-serve-static-core").Response<any, Record<string, any>, number>
 * ; filename: string
 * ; fileUrl : string
 * ; contentType: string
 * ; payload: Buffer | string
 * }} params
 */
async function requestDeepgramAPI({ res, filename, contentType, payload , body }) {


  try {

    const deepgram = new Deepgram(DG_KEY);
    let audioObj;

    if (typeof payload === 'string') {
      audioObj = { url: fileUrl };
    } else {
      audioObj = { buffer: payload, mimetype: contentType  };
    }

  // const author =  transcript.results.channels[0].alternatives[0].words;
  // const words = computeSpeakingTime(author  );
  // res.render("transcript.ejs ",{
  //   words
  // })



    const transcription = await deepgram.transcription.preRecorded(audioObj, {
   //   utterances: body.utterances =='false' ? false : true,
      punctuate: body.punctuate =='false' ? false : true,
      diarize: body.diarize =='false' ? false : true,
      numerals:body.numerals =='false' ? false : true,
      tier  : body.enhance =='false' ? 'base'  : 'enhanced' ,
      model : body.phonecall =='false' ? 'general'  : 'phonecall'
    });


    const transcriptionOriginal = await deepgram.transcription.preRecorded(audioObj);
    // console.log("transcription.results==============>",transcription.results.channels[0].alternatives[0].words);
    // console.log("transcription.results==============>",transcriptionOriginal.results.utterances|"[Speaker:\(.speaker)] \(.transcript)")
    // console.log("transcription.results==============>",transcription.results.)
    const speakers = computeSpeakingTime(transcription  );
      // res.send(transcription)
    return {speakers,transcription  ,transcriptionOriginal , filename};
    // console.log("transcription.results==============>",transcription.results.channels[0].alternatives[0].words)

    // res.render("transcript.ejs", {
    //   speakers,
    //   transcription,
    //   transcriptionOriginal,
    //   filename,
    //   fileUrl,

    // });
  }
  catch (err) {
    error(res, err);
  }
  // console.log('file:' , filename)

}



/**
 * @param {import("express-serve-static-core").Response<any, Record<string, any>, number>} res
 * @param {Error} error
 */
function error(res, error) {
  console.error(error);
  res.status(500).send("Something went wrong :/");
}

/**
 * Handle file upload. The file will be stored on the server's disk
 * before be sent to Deepgram API.
 */
app.post("/", upload.single("file"), async (req, res) => {
  const {diarize, puctuate,numerals , utterances  , enhance} = req.body;
  try {
    if (!req.file) {
      res.send({
        status: "error",
        message: "No file uploaded",
      });
    } else {
      const file = req.file;
      const filePath = file.path.split("/");
      const fileUrl = "/uploaded-file/" + filePath[filePath.length - 1];
      const filename = req.params.filename;

      //console.log(fileUrl)
      // We request file content...
      await fs.readFile(req.file.path, async (err, data) => {
        if (err) {
          error(res, err);
          return;
        }
        // When we have the file content, we forward
        // it to Deepgram API.
        const {speakers,transcription  ,transcriptionOriginal  , filename} = await requestDeepgramAPI({
          res,
          filename: file.originalname,
          fileUrl,
          contentType: file.mimetype,
          payload: data,
          body:req.body,
        });
        res.render("transcript.ejs",{speakers,transcription ,transcriptionOriginal, fileUrl ,filename,body:req.body});
       // console.log(words);
      });
     
    }
  } catch (err) {
    error(res, err);
  }
});


/**
 * Handle file upload from URL.
 */
app.post("/", async (req, res) => {



  try {
    if (!req.body.url) {
      res.send({
        status: "error",
        message: "No url provided",
      });
    } else {
      const url = req.body.url;
      await requestDeepgramAPI({
        res,
        filename: url,
        fileUrl: url,
        contentType: "application/json",
        payload: JSON.stringify({ url }),


      });
    }
  } catch (err) {
    error(res, err);
  }
});

// Mock analyze results
app.get("/", async (_, res) => {
  res.render("transcript.ejs", {
    speakers: [12.5, 143.98],
    filename: "MyFile.mp3",
  });
});

/**
 * Each Deepgram response consists of a transcript, a confidence score, and a word array.
 * In that array, we can see the `start` and `end` timings detailing when each word is said.
 *
 * If we provide the `diarize=true` option, the response will contain a `speaker` field with
 * an associated speaker id (integer, starting at 0) for each word.
 *
 * @typedef {{speaker: number; start:number; end:number; }} Word */

/**
 * Returns an array of speaking time. The number at the index `i` is the
 * speaking time of the speaker `i`.
 *
 * @param transcript
 * @returns { Array<number>}
 */

function computeSpeakingTime(transcript ,res ) {
  const words =  transcript.results.channels[0].alternatives[0].words;
  // console.log(words)
  if (words.length === 0) {
    return[];
  }

    




//   res.render("transcript.ejs", {
//     words
//   });
// async function asyncCall(){
//     console.log(words)
//     await requestDeepgramAPI({
//         word:words
//     })
// }

  /**
   * `timePerSpeaker` tracks speaker time. Keys
   *  are speaker id, values are speaking time.
   * @type {Map<number, number>} */
  const timePerSpeaker = new Map();
  let wordAtLastSpeakerChange = words.shift();
  for (const word of words) {
    // If the speaker changes at this word
    if (wordAtLastSpeakerChange.speaker !== word.speaker) {
      addSpeakingTime(
        wordAtLastSpeakerChange.speaker,
        word.end - wordAtLastSpeakerChange.start,
        timePerSpeaker
      );
      wordAtLastSpeakerChange = word;

    }
  }

  const lastWord = words[words.length - 1];
  addSpeakingTime(
    wordAtLastSpeakerChange.speaker,
    lastWord.end - wordAtLastSpeakerChange.start,
    timePerSpeaker
  );



  return (
    // converting the Map into an array
    [...timePerSpeaker.entries()]
      // sorting by speaker id (keys of the Map)
      .sort((entryA, entryB) => entryA[0] - entryB[0])
      // only keep the speaking times (the values of the Map)
      .map((entry) => entry[1])

  );
    


}

/**
 * @param {number} speaker
 * @param {number} duration
 * @param {Map<number, number>} timePerSpeaker
 */
function addSpeakingTime(speaker, duration, timePerSpeaker ,res) {
  const currentSpeakerDuration = timePerSpeaker.get(speaker) || 0;
  timePerSpeaker.set(speaker, currentSpeakerDuration + duration)

};

//
// app.get('/course/:name/:foo'), async (req, res) => {
//   const { name, id } = req.params;
//   const pages = await getCoursePages(id);
//   let html = '';
//   for(let i = 0; i < pages.length; i++) {
//           html += pages[i].page;
//   }
//   const docx = htmlDocx.asBlob(html);
//   res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//   res.setHeader('Content-Disposition', `attachment; filename=${ sluggify(name) }.docx`);
//   res.setHeader('Content-Length', docx.length);
//   res.send(docx);
  
// };

const listener = server.listen(process.env.PORT, () =>
  console.log(`Server is running on port ${process.env.PORT}/login`)
);