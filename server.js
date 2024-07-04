const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const xss = require('xss-clean');
const winston = require('winston');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 3090;
const VIDEO_FOLDER = "/videos";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 10000, // Limita ogni IP a 10000 richieste per finestra di 15 minuti
  message: 'Troppo traffico dal tuo IP, riprova più tardi.',
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Configurazione di helmet per permettere CORS
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "https:", "'unsafe-inline'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(limiter);
app.use(bodyParser.json({ limit: '10kb' }));
app.use(bodyParser.urlencoded({ limit: '10kb', extended: true }));
app.use(xss());
app.use(cors({
  origin: '*',
  methods: 'GET,HEAD,OPTIONS',
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Funzione helper per aggiungere le intestazioni CORS a tutte le risposte
const addCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
};

// Servire i file statici dalla cartella 'public'
app.use(express.static('public'));

// Rotta per visualizzare la pagina index
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rotta per servire i video
app.get('/video', (req, res) => {
  const videoFile = req.query.v;

  if (!videoFile) {
    console.log('No video file specified.');
    addCorsHeaders(res);
    return res.status(400).send('No video file specified.');
  }

  const videoPath = path.resolve(VIDEO_FOLDER, videoFile);
  console.log('Video file path:', videoPath);

  if (!fs.existsSync(videoPath)) {
    console.log('Video file not found:', videoPath);
    addCorsHeaders(res);
    return res.status(404).send('Video file not found');
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const mimeType = `video/${path.extname(videoFile).slice(1)}`;

  addCorsHeaders(res);

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      addCorsHeaders(res);
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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range',
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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range',
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
  console.log(`Video folder: ${VIDEO_FOLDER}`);
});
