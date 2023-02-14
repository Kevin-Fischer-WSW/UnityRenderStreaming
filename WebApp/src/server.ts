import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as morgan from 'morgan';
import * as formidable from 'formidable';
import signaling from './signaling';
import { log, LogLevel } from './log';
import Options from './class/options';
import { reset as resetHandler }from './class/httphandler';
import { env } from "process";
import * as session from 'express-session';
import * as nocache from "nocache";
import { rejects } from 'assert';

declare module 'express-session' {
  export interface SessionData {
    authorized: boolean;
    username: string;
  }
}

const accessCode = "xcc662245mc1"

const hours = 7200000

export const createServer = (config: Options): express.Application => {
  const app: express.Application = express();
  resetHandler(config.mode);
  // logging http access
  if (config.logging != "none") {
    app.use(morgan(config.logging));
  }
  // const signal = require('./signaling');
  app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true,
    rolling: true,
    // cookie: {
    //   maxAge: hours,
    // }
  }));

  app.all('/operator-controls/*', function(req, res, next) {
    if (!req.session.authorized) {
      return res.status(401).redirect('/');
    }
    //return res.status(200).redirect('/dashboard');
    next();
  });

  app.all('/uapp/:endpoint', function(req, res, next) {
    // Make a http request to the endpoint at http://localhost:4444/endpoint
    // and return the response to the client.
    const http = require('http');
    const endpoint = req.params.endpoint;
    let path = `/${endpoint}`;
    if (req.url.includes('?')) {
      path += `?${req.url.split('?')[1]}`;
    }
    const options = {
      hostname: '127.0.0.1',
      port: 4444,
      path: path,
      method: req.method,
      headers: req.headers,
    };
    const request = http.request(options, (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    req.pipe(request);
  });

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.get('/config', (req, res) => res.json({ useWebSocket: config.websocket, startupMode: config.mode, logging: config.logging }));
  app.use('/signaling', signaling);
  app.use('/samples', (req, res) => res.sendFile(path.join(__dirname, '../client/public/samples.html')));
  app.use(express.static(path.join(__dirname, '../client/public')));
  app.use('/module', express.static(path.join(__dirname, '../client/src')));
  app.use('/node_modules', express.static(path.join(__dirname, '../node_modules')));
  app.get('/', (req, res) => {
    if (req.session.authorized) {
      return res.status(200).redirect('/dashboard');
    } else {
      const indexPagePath: string = path.join(__dirname, '../client/public/operator-controls/login.html');
      res.sendFile(indexPagePath);
    }
  });

  app.post("/auth", (req, res) => {
    if (!req.session.authorized) {
      let uname = req.body.username;
      let pwd = req.body.password;

      const fs = require('fs');
      const objPath: string = path.join(process.cwd(), 'data.json');
      if (fs.existsSync(objPath) === false) {
        // Create the file.
        fs.writeFileSync(objPath, JSON.stringify({uname: "admin", pwd: "EagleEye2023"}), 'utf8');
      }
      let rawdata = fs.readFileSync(objPath);
      let obj = JSON.parse(rawdata);

      if (uname === obj.uname && pwd === obj.pwd) {
        req.session.username = uname;
        req.session.authorized = true;
        req.session.cookie.maxAge = hours;
        res.status(200).redirect('/dashboard')
      } else {
        res.status(401).redirect('/')
      }
    } else {
      res.status(200).redirect('/dashboard')
    }
  });

  app.get("/dashboard", (req, res) => {
    if (req.session.authorized) {
      const indexPagePath: string = path.join(__dirname, '../client/public/operator-controls/index.html');
      return res.sendFile(path.join(indexPagePath));
    } else {
      return res.status(401).redirect("/");
    }
  });

  app.get("/signout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.log(err);
        res.status(400).send(err)
      } else {
        res.status(200).redirect("/");
      }
    })
  });

  // todo Use a different method to extend the session
  app.get('/extend', (req, res) => {
    if (req.session.authorized) {
      res.status(200).json({valid:true})
    } else {
      res.status(401).json({valid:false})
    }
  });

  function ValidatePathExists(res, filePath) {
    if (!fs.existsSync(filePath)) {
      let message = `File ${filePath} does not exist on server`;
      console.log(message);
      res.status(500).json({ message: message })
      return false;
    }
    return true;
  }

  function GetLastModifiedTime(path) {
    if (fs.existsSync(path)) {
      let stat = fs.statSync(path);
      return stat.mtimeMs;
    }
    return 0;
  }
  // Get the last time (via query) a specific slide  was updated.
  app.get('/last_slide_update/:slide', (req, res) => {
    let slide = path.join(config.holdingSlideDir, req.params.slide);
    res.json({ lastUpdate: GetLastModifiedTime(slide) })
  });
  // Get the last time a holding music file was updated.
  app.get('/last_holding_music_update/:music', (req, res) => {
    let music = path.join(config.holdingMusicDir, req.params.music);
    res.json({ lastUpdate: GetLastModifiedTime(music) })
  });
  // Get the last time a video file was updated.
  app.get('/last_video_update/:video', (req, res) => {
    let video = path.join(config.videoDir, req.params.video);
    res.json({ lastUpdate: GetLastModifiedTime(video) })
  });

  let holdingSlidePath = config.holdingSlideDir;
  let customSlidePath = path.join(holdingSlidePath, 'Custom Slides')
  // Get specific slide image.
  app.get('/slides/:slide', (req, res) => {
    // Check custom slides directory first.
    let slidePath = path.join(customSlidePath, req.params.slide);
    if (!fs.existsSync(slidePath)) {
      res.sendFile(path.join(holdingSlidePath, req.params.slide))
    } else {
      res.sendFile(slidePath)
    }
  });

  let holdingMusicDir = config.holdingMusicDir;
  // Get specific holding music file.
  app.get('/music/:music', (req, res) => {
    res.sendFile(path.join(holdingMusicDir, req.params.music))
  });

  let videoDir = config.videoDir;
  // Get specific video file.
  app.get('/videos/:video', (req, res) => {
    res.sendFile(path.join(videoDir, req.params.video))
  });

  // Helper function to get all files in a directory.
  function getFiles(res, dir) {
    if (ValidatePathExists(res, dir) === false) return;
    // Get all files under directory.
    let data = fs.readdirSync(dir);
    res.status(200).json(data);
  }

  // Get all custom slides.
  app.get('/all_custom_slides', (req, res) => {
    getFiles(res, customSlidePath);
  })

  // Get all holding music.
  app.get('/all_holding_music', (req, res) => {
    getFiles(res, holdingMusicDir);
  })

  // Get all videos.
  app.get('/all_videos', (req, res) => {
    getFiles(res, videoDir);
  })

  function MoveFiles(res, files, _path){
    // Note: Despite iterating through files, one file is typically uploaded.
    let status = 201;
    let _messages = [];
    Object.keys(files).map((fKey) => {
      let oldPath = files[fKey].filepath;
      let newPath = path.join(_path, fKey)
      try {
        fs.renameSync(oldPath, newPath);
      } catch (err) {
        console.log(err);
        status = 500;
        _messages.push(`${fKey} not uploaded. Error: ${err}`);
      }
      _messages.push(`${fKey} uploaded successfully`);
    });
    res.status(status).json({messages : _messages});
  }

  app.post('/slide_upload', (req, res, next) => {
    let form = new formidable.IncomingForm()
    // Parse submitted form data.
    form.parse(req, function (err, fields, files) {
      if (err) next(err);
      // Determine upload path via type.
      let uploadPath;
      if (fields.type === 'custom_slide') {
        uploadPath = customSlidePath;
      } else if (fields.type === 'slide') {
        uploadPath = holdingSlidePath;
      } else if (fields.type === 'music') {
        uploadPath = holdingMusicDir;
      } else if (fields.type === 'video') {
        uploadPath = videoDir;
      } else {
        res.status(400).json({messages: ['Invalid upload type']});
        return;
      }
      if (ValidatePathExists(res, uploadPath) === false) return;
      MoveFiles(res, files, uploadPath);
    });
  });

  function DeleteFile(res, _path) {
    if (ValidatePathExists(res, _path) === false) return;
    try {
      fs.unlinkSync(_path);
      res.status(200).json({message: ['File deleted successfully']});
    } catch (err) {
      console.log(err);
      res.status(500).json({message: `File not deleted. Error: ${err}`});
    }
  }

  app.delete('/slide_delete/:slide', (req, res) => {
    let slidePath = path.join(customSlidePath, req.params.slide);
    DeleteFile(res, slidePath);
  });

  app.delete('/music_delete/:music', (req, res) => {
    let musicPath = path.join(holdingMusicDir, req.params.music);
    DeleteFile(res, musicPath);
  });

  app.delete('/video_delete/:video', (req, res) => {
    let videoPath = path.join(videoDir, req.params.video);
    DeleteFile(res, videoPath);
  });

  //list recordings
  app.get("/listRecordings/:skey", (req, res) => {

    let data = [];

    /* In this case only checking to see if the dir exists.*/
    if (ValidatePathExists(res, config.recordingsDir) === false) return;
    const files = fs.readdirSync(config.recordingsDir)
    files.forEach(file => {
      if (file.split("__")[0] === req.params.skey) {
        data.push(file);
      }
    })
    res.status(200).json(data);

  });

  // download recordings
  app.get("/download/:skey", (req, res) => {

    let recordingsPath = path.join(config.recordingsDir, req.params.skey);
    if (ValidatePathExists(res, recordingsPath) === false){
      res.status(500).json({ message: `File ${recordingsPath} does not exist on server` })
      return;
    }

    res.attachment(req.params.skey);
    res.download(
      recordingsPath,
      req.params.skey, // Remember to include file extension
      (err) => {
        if (err) {
          console.log(err);
          res.status(500).end();
        }
      });
  });

  app.get("/update_info", (req, res) => {
    if (!req.session.authorized) {
      return res.status(401).redirect('/');
    }
    const updatePagePath: string = path.join(__dirname, '../client/public/operator-controls/update.html');
    return res.sendFile(path.join(updatePagePath));

  });

  app.post("/save_info", (req, res) => {
    if (req.session.authorized) {
      let uname = req.body.username;
      let pwd = req.body.password;
      let access_code = req.body.accesscode;

      //console.log(req.body.username, req.body.password, req.body.accesscode)

      if (access_code === accessCode) {

        const objPath: string = path.join(process.cwd(), 'data.json');
        let obj = JSON.stringify({"uname":uname, "pwd":pwd});

        var fs = require('fs');
        fs.writeFile(objPath, obj, 'utf8', (err) => {
          if (err) console.log(err);
          console.log("Save Successfull");
        });
        res.status(200).redirect('/signout')
      } else {
        res.status(401).redirect('/update_info')
      }
    } else {
      res.status(200).redirect('/')
    }
  });

  return app;
};
