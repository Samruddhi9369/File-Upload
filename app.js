const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const methodOverride = require('method-override');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.set('view engine', 'ejs'); // EJS Template Engine

// Mongo URL
const mongoURI = 'mongodb://sam:sam@ds163377.mlab.com:63377/fileuploadstorage';

// Create Mongo Connection
const conn = mongoose.createConnection(mongoURI);

// Init gfs
let gfs;

conn.once('open', () => {
    // Init Stream
    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection('uploads');
});

// Init storage
const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            return reject(err);
          }
          const filename = buf.toString('hex') + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: 'uploads' //bucket name should match with collections name
          };
          resolve(fileInfo);
        });
      });
    }
  });
  const upload = multer({ storage });

app.get('/', (req, res) => {
    gfs.files.find().toArray((err, files) => {
        if(!files || files.length === 0){
            res.render('index', { files: false });
        } else {
            files.map(file => {
                if(file.contentType === 'image/jpeg' || file.contentType === 'image/png'){
                    file.isImage = true;
                } else {
                    file.isImage = false;
                }
            });
        }
        res.render('index', { files: files });
    });
});

// Upload file
app.post('/upload', upload.single('file'), (req, res) => {
    //res.json({ file: req.file });
    res.redirect('/');
});

// Get all files
app.get('/files', (req, res) => {
    gfs.files.find().toArray((err, files) => {
        if(!files || files.length === 0){
            return res.status(404).json({
                err: 'No files exist'
            });
        } 
        return res.json(files);
    });
});

// Get File
app.get('/files/:filename', (req, res) => {
    gfs.files.findOne({filename: req.params.filename}, (err, file) => {
        if(!file || file.length === 0){
            return res.status(404).json({
                err: 'No file exist'
            });
        } 
        return res.json(file);
    });
});

// View image
app.get('/image/:filename', (req, res) => {
    gfs.files.findOne({filename: req.params.filename}, (err, file) => {
        if(!file || file.length === 0){
            return res.status(404).json({
                err: 'No file exist'
            });
        } 
        // Check if image
        if(file.contentType === 'image/jpeg' || file.contentType === 'image/png'){
            // Read output to browser
            const readstream = gfs.createReadStream(file.filename);
            readstream.pipe(res);
        } else {
            return res.status(404).json({
                err: 'Not an image'
            });
        }
    });
});

// Delete File
app.delete('/files/:id', (req, res) => {
    gfs.remove({_id: req.params.id, root: 'uploads'}, (err, gridStore) => {
        if (err) 
            return res.status(404).json({ err:err});
        res.redirect('/');
    });
});

const port = '5000';

app.listen(port, () => console.log('Server started on port '+ port));