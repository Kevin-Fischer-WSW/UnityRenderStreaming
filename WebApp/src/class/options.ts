export default interface Options {
  secure?: boolean;
  port?: number;
  cafile?: string;
  keyfile?: string;
  certfile?: string;
  websocket?: boolean;
  mode?: string;
  logging?: string;
  holdingSlideDir?: string;
  holdingMusicDir?: string;
  videoDir?: string;
  recordingsDir?: string;
  eagleEyeLogDir?: string;
  videoEditingDir?: string;
}
