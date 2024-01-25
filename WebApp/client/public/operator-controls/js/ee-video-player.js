﻿import { Signaling, WebSocketSignaling } from "../../module/signaling.js";
import Peer from "../../module/peer.js";
import * as Logger from "../../module/logger.js";
import {getRTCConfiguration} from "../../js/config.js";
import {MessageTypes} from "./message-type-map.gen.js";

function uuid4() {
  var temp_url = URL.createObjectURL(new Blob());
  var uuid = temp_url.toString();
  URL.revokeObjectURL(temp_url);
  return uuid.split(/[:/]/g).pop().toLowerCase(); // remove prefixes
}

export class VideoPlayer extends EventTarget {
  constructor(elements) {
    super();
    const _this = this;
    this.pc = null;
    this.channel = null;
    this.connectionId = null;

    // main video
    this.localStream = new MediaStream();
    this.video = elements[0];
    this.video.playsInline = true;
    this.video.addEventListener('loadedmetadata', function () {
      _this.video.play();
      _this.resizeVideo();
    }, true);

    // secondly video
    this.localStream2 = new MediaStream();
    this.videoThumb = elements[1];
    this.videoThumb.playsInline = true;
    this.videoThumb.addEventListener('loadedmetadata', function () {
      _this.videoThumb.play();
    }, true);

    this.videoTrackList = [];
    this.maxVideoTrackLength = 2;
    this.videosAdded = false;
  }

  async setupConnection(useWebSocket) {
    const _this = this;
    // close current RTCPeerConnection
    if (this.pc) {
      Logger.log('Close current PeerConnection');
      this.pc.close();
      this.pc = null;
    }

    if (useWebSocket) {
      this.signaling = new WebSocketSignaling();
    } else {
      this.signaling = new Signaling();
    }

    this.connectionId = uuid4();
    localStorage.setItem('connectionId', this.connectionId);

    // Create peerConnection with proxy server and set up handlers
    const config = getRTCConfiguration();
    this.pc = new Peer(this.connectionId, true, config);

    this.pc.addEventListener('trackevent', (e) => {
      const data = e.detail;
      if (data.track.kind === 'video') {
        _this.videoTrackList.push(data.track);
      }
      if (data.track.kind === 'audio') {
        data.track.enabled = false;
        _this.localStream.addTrack(data.track);
      }
      if (_this.videoTrackList.length === _this.maxVideoTrackLength && !_this.videosAdded) {
        _this.videosAdded = true;
        _this.localStream.addTrack(this.videoTrackList[0]);
        _this.localStream2.addTrack(this.videoTrackList[1]);
        _this.video.srcObject = _this.localStream;
        _this.videoThumb.srcObject = _this.localStream2;
      }
    });
    this.pc.addEventListener('sendoffer', (e) => {
      const offer = e.detail;
      _this.signaling.sendOffer(offer.connectionId, offer.sdp);
    });
    this.pc.addEventListener('sendanswer', (e) => {
      const answer = e.detail;
      _this.signaling.sendAnswer(answer.connectionId, answer.sdp);
    });
    this.pc.addEventListener('sendcandidate', (e) => {
      const candidate = e.detail;
      _this.signaling.sendCandidate(candidate.connectionId, candidate.candidate, candidate.sdpMid, candidate.sdpMLineIndex);
    });

    this.signaling.addEventListener('offer', async (e) => {
      const offer = e.detail;
      const desc = new RTCSessionDescription({ sdp: offer.sdp, type: "offer" });
      if (_this.pc != null) {
        await _this.pc.onGotDescription(offer.connectionId, desc);
      }
    });
    this.signaling.addEventListener('answer', async (e) => {
      const answer = e.detail;
      const desc = new RTCSessionDescription({ sdp: answer.sdp, type: "answer" });
      if (_this.pc != null) {
        await _this.pc.onGotDescription(answer.connectionId, desc);
      }
    });
    this.signaling.addEventListener('candidate', async (e) => {
      const candidate = e.detail;
      const iceCandidate = new RTCIceCandidate({ candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex });
      if (_this.pc != null) {
        await _this.pc.onGotCandidate(candidate.connectionId, iceCandidate);
      }
    });

    // setup signaling
    await this.signaling.start();

    // Create data channel with proxy server and set up handlers
    this.channel = this.pc.createDataChannel(this.connectionId, 'data');
    this.channel.onopen = function () {
      _this.dispatchEvent(new CustomEvent("dataChannelOpen"));
      Logger.log('Datachannel connected.');
    };
    this.channel.onerror = function (e) {
      Logger.log("The error " + e.error.message + " occurred\n while handling data with proxy server.");
    };
    this.channel.onclose = function () {
      _this.dispatchEvent(new CustomEvent("dataChannelClose"));
      Logger.log('Datachannel disconnected.');
    };
    this.channel.onmessage = async (msg) => {
      // receive message from unity and operate message
      let data = msg.data;
      let msgType = data[0];
      let msgContents = data.substring(1)
      switch(msgType){
        case MessageTypes._ParticipantData:
          if (_this.onParticipantDataReceived) {
            _this.onParticipantDataReceived.call(_this, msgContents);
          }
          break;
        case MessageTypes._AppStatus:
          if (_this.onAppStatusReceived) {
            _this.onAppStatusReceived.call(_this, msgContents);
          }
          break;
        case MessageTypes._StyleValues:
          if (_this.onStyleValuesReceived){
            _this.onStyleValuesReceived.call(_this, msgContents);
          }
          break;
        case MessageTypes._LogMessageNotification:
          if (_this.onLogMessageNotification){
            _this.onLogMessageNotification.call(_this, msgContents);
          }
          break;
        case MessageTypes._NewMediaNotification:
          if (_this.onNewMediaNotification){
            _this.onNewMediaNotification.call(_this, msgContents);
          }
          break;
        case MessageTypes._MusicPlaybackTime:
          if (_this.onMusicPlaybackTimeReceived){
            _this.onMusicPlaybackTimeReceived.call(_this, msgContents);
          }
          break;
        case MessageTypes._VideoPlaybackTime:
          if (_this.onVideoPlaybackTimeReceived){
            _this.onVideoPlaybackTimeReceived.call(_this, msgContents);
          }
          break;
        case MessageTypes._WrongPasswordNotification:
          if (_this.onWrongPasswordNotification){
            _this.onWrongPasswordNotification.call(_this, msgContents);
          }
          break;
        case MessageTypes._RegistrationUrl:
          if (_this.onRegistrationUrlReceived){
            _this.onRegistrationUrlReceived.call(_this, msgContents);
          }
          break;
        case MessageTypes._DbLevelNotification:
          if (_this.onDbLevelNotification){
            _this.onDbLevelNotification.call(_this, msgContents);
          }
          break;
      }
    };
  }

  resizeVideo() {
    const clientRect = this.video.getBoundingClientRect();
    const videoRatio = this.videoWidth / this.videoHeight;
    const clientRatio = clientRect.width / clientRect.height;

    this._videoScale = videoRatio > clientRatio ? clientRect.width / this.videoWidth : clientRect.height / this.videoHeight;
    const videoOffsetX = videoRatio > clientRatio ? 0 : (clientRect.width - this.videoWidth * this._videoScale) * 0.5;
    const videoOffsetY = videoRatio > clientRatio ? (clientRect.height - this.videoHeight * this._videoScale) * 0.5 : 0;
    this._videoOriginX = clientRect.left + videoOffsetX;
    this._videoOriginY = clientRect.top + videoOffsetY;
  }

  get videoWidth() {
    return this.video.videoWidth;
  }

  get videoHeight() {
    return this.video.videoHeight;
  }

  get videoOriginX() {
    return this._videoOriginX;
  }

  get videoOriginY() {
    return this._videoOriginY;
  }

  get videoScale() {
    return this._videoScale;
  }

  get videoAudioTracks() {
    return this.localStream.getAudioTracks();
  }

  sendMsg(msg) {
    if (this.channel == null) {
      return;
    }
    switch (this.channel.readyState) {
      case 'connecting':
        this.dispatchEvent(new CustomEvent("dataChannelConnecting"));
        Logger.log('Connection not ready');
        break;
      case 'open':
        this.channel.send(msg);
        break;
      case 'closing':
        this.dispatchEvent(new CustomEvent("dataChannelClosing"));
        Logger.log('Attempt to sendMsg message while closing');
        break;
      case 'closed':
        Logger.log('Attempt to sendMsg message while connection closed.');
        break;
    }
  }

  async stop() {
    if (this.signaling) {
      await this.signaling.stop();
      this.signaling = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }

  async getStats() {
    return await this.pc.getStats();
  }
}
