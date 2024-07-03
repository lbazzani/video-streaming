const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const validator = require('validator');
const bodyParser = require('body-parser');
const xss = require('xss-clean');
const ExpressBrute = require('express-brute');
const winston = require('winston');
require('dotenv').config();

const app = express();
const PORT = 3090;
const VIDEO_FOLDER = "/videos";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // Limita ogni IP a 100 richieste per finestra di 15 minuti
  message: 'Troppo traffico dal tuo IP, riprova più tardi.',
});

const store = new ExpressBrute.MemoryStore();
const bruteforce = new ExpressBrute(store, {
  freeRetries: 5,
  minWait: 5 * 60 * 1000, // 5 minuti
  maxWait: 60 * 60 * 1000, // 1 ora
  lifetime: 24 * 60 * 60, // 1 giorno
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

app.use(helmet());
app.use(limiter);
app.use(bodyParser.json({ limit: '10kb' }));
app.use(bodyParser.urlencoded({ limit: '10kb', extended: true }));
app.use(xss());

// Servire i file statici dalla cartella 'public'
app.use(express.static('public'));

// Rotta per visualizzare la pagina index
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/video', bruteforce.prevent, (req, res) => {
  const videoFile = req.query.v;
  if (!videoFile || !validator.isAlphanumeric(videoFile.replace(/\.[^/.]+$/, ""))) {
    console.log('Invalid video file name:', videoFile);
    return res.status(400).send('Video file name is invalid');
  }

  const videoPath = path.resolve(VIDEO_FOLDER, videoFile);

  if (!fs.existsSync(videoPath)) {
    console.log('Video file not found:', videoPath);
    return res.status(404).send('Video file not found');
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const mimeType = `video/${path.extname(videoFile).slice(1)}`;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
        console
        res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
        return;
    }

    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': mimeType,
    };

    res.writeHead(206, head);
    file.pipe(res).on('error', (err) => {
      console.error('Stream error:', err);
      res.status(500).send('Internal Server Error');
    });
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': mimeType,
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath)
      .pipe(res)
      .on('error', (err) => {
        console.error('Stream error:', err);
        res.status(500).send('Internal Server Error');
      });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Video folder: ${VIDEO_FOLDER}`)
});
