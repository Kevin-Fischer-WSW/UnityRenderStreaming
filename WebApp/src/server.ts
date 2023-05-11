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
import * as Ffmpeg  from 'fluent-ffmpeg';
import {FfprobeData} from "fluent-ffmpeg";
import {execSync} from "child_process";

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
      hostname: 'localhost',
      port: 46000,
      path: path,
      method: req.method,
      headers: req.headers,
    };
    const request = http.request(options, (response) => {
      res.writeHead(response.statusCode, response.statusMessage, response.headers);
      response.pipe(res);
    });
    request.on('error', (error) => {
      log(LogLevel.error, error);
      res.status(500).send(error);
    });
    req.pipe(request);
  });

  app.use(express.urlencoded({ extended: true, limit: '2gb' }));
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

  app.get("/videoeditor", (req, res) => {
    if (req.session.authorized) {
      const indexPagePath: string = path.join(__dirname, '../client/public/video-editor/index.html');
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

  let holdingSlidePath = config.holdingSlideDir;
  // Get specific slide image.
  app.get('/slides/:slide', (req, res) => {
    let slidePath = path.join(holdingSlidePath, req.params.slide);
    if (ValidatePathExists(res, slidePath)){
      res.sendFile(slidePath);
    }
  });

  let holdingMusicDir = config.holdingMusicDir;
  // Get specific holding music file.
  app.get('/music/:music', (req, res) => {
    res.sendFile(path.join(holdingMusicDir, req.params.music))
  });

  // Helper function to get all files in a directory.
  function getFiles(res, dir) {
    if (ValidatePathExists(res, dir) === false) return;
    // Get all files under directory.
    let data = fs.readdirSync(dir);
    res.status(200).json(data);
  }

  // Get all holding music.
  app.get('/all_holding_music', (req, res) => {
    getFiles(res, holdingMusicDir);
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
    const options = {
      multiples: true,
      maxFileSize: 2 * 1024 * 1024 * 1024, // 2 GB
    }
    let form = new formidable.IncomingForm(options)
    // Parse submitted form data.
    form.parse(req, function (err, fields, files) {
      if (err){
        next(err);
        return;
      }
      // Determine upload path via type.
      let uploadPath;
      if (fields.type === 'slide') {
        uploadPath = holdingSlidePath;
      } else if (fields.type === 'music') {
        uploadPath = holdingMusicDir;
      } else if (fields.type === 'video') {
        uploadPath = holdingSlidePath;
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

  function DeleteDirectory(res, _path) {
    // For extra safety, only allow deletion inside video editor directory.
    if (_path.includes(videoEditingDir) === false) {
      res.status(400).json({message: 'Invalid directory path'});
      return;
    }
    if (ValidatePathExists(res, _path) === false)
      return;
    try {
      fs.rmdirSync(_path, {recursive: true});
      res.status(200).json({message: 'Directory deleted successfully'});
    } catch (err) {
      console.log(err);
      res.status(500).json({message: "Directory not deleted. Error: ".concat(err)});
    }
  }

  app.delete('/slide_delete/:slide', (req, res) => {
    let slidePath = path.join(holdingSlidePath, req.params.slide);
    DeleteFile(res, slidePath);
  });

  app.delete('/music_delete/:music', (req, res) => {
    let musicPath = path.join(holdingMusicDir, req.params.music);
    DeleteFile(res, musicPath);
  });

  //list recordings
  app.get("/listRecordings/:skey", async (req, res) => {

    let data = [];

    /* In this case only checking to see if the dir exists.*/
    if (ValidatePathExists(res, config.recordingsDir) === false) return;
    const files = fs.readdirSync(config.recordingsDir)
    for (let i = 0; i < files.length; i++){
      const file = files[i];
      if (file.split("__")[0] === req.params.skey) {
        // Get duration of recording using fluent-ffmpeg.
        let filePath = path.join(config.recordingsDir, file);
        let duration = 0;
        await probe(filePath).then((metadata:FfprobeData) => {
          duration = metadata.format.duration;
          data.push({file: file, duration: duration});
        }).catch((err) => {
          console.log(err);
        });
      }
    }
    res.status(200).json(data);
  });

  async function probe(file){
    return new Promise((resolve, reject) => {
      Ffmpeg.ffprobe(file, (err, metadata) => {
        if (err) reject(err);
        resolve(metadata);
      });
    });
  }

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

  app.get("/logs", (req, res) => {
    if (!req.session.authorized) {
      return res.status(401).redirect('/');
    }
    // Return files ending in .log residing in the logs directory.
    const logDir: string = config.eagleEyeLogDir;
    if (ValidatePathExists(res, logDir) === false) return;
    const files = fs.readdirSync(logDir)
    let data = [];
    files.forEach(file => {
      if (file.endsWith('.log')) {
        data.push(file);
      }
    })
    res.status(200).json(data);
  });

  app.get("/download_log/:log", (req, res) => {
    if (!req.session.authorized) {
      return res.status(401).redirect('/');
    }
    let logPath = path.join(config.eagleEyeLogDir, req.params.log);
    if (ValidatePathExists(res, logPath) === false) {
      res.status(500).json({message: `File ${logPath} does not exist on server`})
      return;
    }
    res.attachment(req.params.log);
    res.download(
      logPath,
      req.params.log, // Remember to include file extension
      (err) => {
        if (err) {
          console.log(err);
          res.status(500).end();
        }
      });
  });

  let videoEditingDir = path.normalize(config.videoEditingDir);
  app.get("/listVideoEditingProjects", (req, res)=>{
    // Get a list of all the directories in the video editing directory.
    getFiles(res, videoEditingDir);
  })

  app.get("/videoEditingProjectData/:project", (req, res)=>{
    // Get the data.json file for the project.
    let projectPath = path.join(videoEditingDir, req.params.project);
    if (ValidatePathExists(res, projectPath) === false) return;
    let dataPath = path.join(projectPath, "data.json");
    if (ValidatePathExists(res, dataPath) === false) return;
    let data = JSON.parse(fs.readFileSync(dataPath).toString());
    res.status(200).json(data);
  })

  app.get("/videoEditingProjectPreview/:project", (req, res)=>{
    // Get the preview.mp4 file for the project.
    let projectPath = path.join(videoEditingDir, req.params.project);
    if (ValidatePathExists(res, projectPath) === false) return;
    let previewPath = path.join(projectPath, "preview.mp4");
    if (ValidatePathExists(res, previewPath) === false) return;
    res.status(200).sendFile(previewPath);
  })

  app.put("/submitVideoEdits", (req, res) => {

    if (req.session.authorized) {
      if (req.body.projectName === undefined || req.body.projectData === undefined){
        res.status(400).json({message: "Invalid request"});
        return;
      }
      // Create directory for the project.
      let projectPath = path.join(videoEditingDir, req.body.projectName);
      if (fs.existsSync(projectPath) === false){
        fs.mkdirSync(projectPath);
      }

      // Validate the project data.
      if (validateVideoEditingProjectData(req.body.projectData) === false){
        res.status(400).json({message: "Invalid project data"});
        return;
      }

      // Save the data.json to the directory.
      let dataPath = path.join(projectPath, "data.json");
      let data = JSON.stringify(req.body.projectData);
      fs.writeFileSync(dataPath, data);

      //todo parse cuts and clips to output txt file for ffmpeg.
      let clips = req.body.projectData.clips;
      let cutSpans = req.body.projectData.cutSpans; // note: this list is sorted by apparentStart.

      let ffmpegInput = "";
      let lastCutSpanIdx = 0;
      let clipPath = "";
      // Iterate through clips.
      for (let i = 0; i < clips.length; i++) {
        // Get the clip's path.
        clipPath = path.join(config.recordingsDir, clips[i].name);
        ffmpegInput += `file '${clipPath}'\n`;
        // Iterate through cut spans while the current clip is the same as the cut span's clip.
        let firstCutSpanIdx = lastCutSpanIdx;
        for (let j = lastCutSpanIdx; j < cutSpans.length && cutSpans[j].clipIndex === i; j++) {
          // Concatenate the cut span's start and end times.
          if (cutSpans[j].inpoint !== 0){
            ffmpegInput += `outpoint ${cutSpans[j].inpoint}\n`;
          }
          if (cutSpans[j].outpoint !== clips[i].duration){
            if (j !== firstCutSpanIdx) ffmpegInput += `file '${clipPath}'\n`;
            ffmpegInput += `inpoint ${cutSpans[j].outpoint}\n`;
          }
          lastCutSpanIdx++;
        }
      }
      // Write the ffmpeg input file.
      let ffmpegInputPath = path.join(projectPath, "input.txt");
      fs.writeFileSync(ffmpegInputPath, ffmpegInput);
      // Run ffmpeg to generate the preview.
      let ffmpegOutputPath = path.join(projectPath, "preview.mp4");
      execSync(`ffmpeg -f concat -safe 0 -i "${ffmpegInputPath}" -c copy "${ffmpegOutputPath}" -y`)
      // Note: We will run into issues if two people try to request at the same time.
      // send a json back containing the src for the rendered preview.
      res.status(200).json({message: "success"});
    }

  });

  function validateVideoEditingProjectData(data){
    // Not undefined.
    if (data === undefined) return false;
    if (data.clips === undefined) return false;
    if (data.cutSpans === undefined) return false;
    // Clips and cut spans are arrays.
    if (Array.isArray(data.clips) === false) return false;
    if (Array.isArray(data.cutSpans) === false) return false;
    // Cut spans are in order, don't overlap, and are within the bounds of the clips.
    for (let i = 0; i < data.cutSpans.length; i++){
      let span = data.cutSpans[i];
      if (span.inpoint > span.outpoint) return false;
      if (span.inpoint < 0) return false;
      if (span.clipIndex < 0) return false;
      if (span.clipIndex >= data.clips.length) return false;
      if (span.outpoint > data.clips[span.clipIndex].duration) return false;
      if (i > 0){
        if (span.inpoint < data.cutSpans[i-1].outpoint) return false;
      }
    }
    return true;
  }

  app.delete("/deleteVideoEditingProject/:project", (req, res) => {
    if (req.session.authorized) {
      let projectPath = path.join(videoEditingDir, req.params.project);
      DeleteDirectory(res, projectPath);
    }
  });

  return app;
};
