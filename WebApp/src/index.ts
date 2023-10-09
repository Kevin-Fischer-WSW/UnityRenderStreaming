import { Command } from 'commander';
import * as express from 'express';
import * as https from 'https';
import { Server } from 'http';
import * as fs from 'fs';
import * as os from 'os';
import { createServer } from './server';
import { AddressInfo } from 'net';
import WSSignaling from './websocket';
import Options from './class/options';
import * as path from "path";
import {exec} from "child_process";
import {log, LogLevel} from "./log";

export class RenderStreaming {
  public static run(argv: string[]): RenderStreaming {
    const program = new Command();
    const readOptions = (): Options => {
      if (Array.isArray(argv)) {
        program
          .usage('[options] <apps...>')
          .option('-p, --port <n>', 'Port to start the server on', process.env.PORT || `80`)
          .option('-s, --secure', 'Enable HTTPS (you need server.key and server.cert)', process.env.SECURE || false)
          .option('-k, --keyfile <path>', 'https key file (default server.key)', process.env.KEYFILE || 'server.key')
          .option('-c, --certfile <path>', 'https cert file (default server.cert)', process.env.CERTFILE || 'server.cert')
          .option('-w, --websocket', 'Enable Websocket Signaling', process.env.WEBSOCKET || false)
          .option('-m, --mode <type>', 'Choose Communication mode public or private (default public)', process.env.MODE || 'public')
          .option('-l, --logging <type>', 'Choose http logging type combined, dev, short, tiny or none.(default dev)', process.env.LOGGING || 'dev')
          .option('-h, --holdingSlideDir <path>', 'Directory where holding slides shall be stored.', path.join(process.cwd(), 'Holding Slides'))
          .option('-u, --holdingMusicDir <path>', 'Directory where holding music shall be stored.', path.join(process.cwd(), 'Holding Music'))
          .option('-v, --videoDir <path>', 'Directory where videos shall be stored.', path.join(process.cwd(), 'Holding Slides/Custom Videos'))
          .option('-r, --recordingsDir <path>', 'Directory where recorded videos shall be stored.', path.join(process.cwd(), 'Recordings'))
          .option('-g, --eagleEyeLogDir <path>', 'Directory where eagle eye log shall be stored.', path.join(process.env.APPDATA, "../LocalLow/DefaultCompany/EE Unity Project"))
          .option('-e, --videoEditingDir <path>', 'Directory where edited videos shall be stored.', path.join(process.cwd(), 'Video Edits'))
          .parse(argv);
        const option = program.opts();
        return {
          port: option.port,
          secure: option.secure == undefined ? false : option.secure,
          keyfile: option.keyfile,
          certfile: option.certfile,
          websocket: option.websocket == undefined ? false : option.websocket,
          mode: option.mode,
          logging: option.logging,
          holdingSlideDir: option.holdingSlideDir,
          holdingMusicDir: option.holdingMusicDir,
          videoDir: option.videoDir,
          recordingsDir: option.recordingsDir,
          eagleEyeLogDir: option.eagleEyeLogDir,
          videoEditingDir: option.videoEditingDir
        };
      }
    };
    const options = readOptions();
    return new RenderStreaming(options);
  }

  public app: express.Application;

  public server?: Server;

  public options: Options;

  constructor(options: Options) {
    this.options = options;
    this.app = createServer(this.options);
    if (this.options.secure) {
      this.server = https.createServer({
        key: fs.readFileSync(options.keyfile),
        cert: fs.readFileSync(options.certfile),
      }, this.app).listen(this.options.port, () => {
        const { port } = this.server.address() as AddressInfo;
        const addresses = this.getIPAddress();
        for (const address of addresses) {
          console.log(`https://${address}:${port}`);
        }
      });
    } else {
      this.server = this.app.listen(this.options.port, () => {
        const { port } = this.server.address() as AddressInfo;
        const addresses = this.getIPAddress();
        for (const address of addresses) {
          console.log(`http://${address}:${port}`);
        }
      });
    }

    if (this.options.websocket) {
      console.log(`start websocket signaling server ws://${this.getIPAddress()[0]}`);
      //Start Websocket Signaling server
      let wss = new WSSignaling(this.server, this.options.mode);
      this.app.put('/alert', (req, res) => {
        // Only proceed if request is from localhost
        if (req.socket.remoteAddress === req.socket.localAddress) {
          console.log(`${req.body.type} : ${req.body.message}`);
          wss.alert(req.body);
          res.sendStatus(200);
        }
        else {
          res.sendStatus(403);
        }
      });
      this.app.put('/reboot', function(req, res, next) {
        // Reboot the server.
        const exec = require('child_process').exec;
        exec('shutdown /r /t 0', (error, stdout, stderr) => {
          if (error) {
            log(LogLevel.error, error);
          }
          if (stderr) {
            log(LogLevel.error, stderr);
          }
          wss.alertmsg('info', 'Server is rebooting.');
          wss.alertmsg('reboot', '');
          res.status(200).send('Rebooting');
        });
      });
    }

    console.log(`start as ${this.options.mode} mode`);
  }

  getIPAddress(): string[] {
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];
    for (const k in interfaces) {
      for (const k2 in interfaces[k]) {
        const address = interfaces[k][k2];
        if (address.family === 'IPv4') {
          addresses.push(address.address);
        }
      }
    }
    return addresses;
  }
}

RenderStreaming.run(process.argv);
