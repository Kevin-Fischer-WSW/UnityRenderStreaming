﻿/*
This file sets up and updates elements related to Unity render streaming and disables context menu.
 */
import {VideoPlayer} from "/operator-controls/js/ee-video-player.js";
import {getServerConfig} from "/js/config.js";
import { createDisplayStringArray } from "/js/stats.js";

setup();

export let myVideoPlayer;

let useWebSocket;

const messageDiv = document.getElementById("message-div");

let playButton;
const playerDiv = document.getElementById("video-players");
const outputDiv = document.getElementById("output-video-container");
const previewDiv = document.getElementById("preview-video-container");
const outputColDiv = document.getElementById("output-container-col");
const previewColDiv = document.getElementById("preview-container-col");
outputColDiv.style.position = "relative";
previewColDiv.style.position = "relative";

class MainNotifications extends EventTarget {
  notifyVideoSetup() {
    this.dispatchEvent(new Event('setup'));
  }
}
export let mainNotifications = new MainNotifications();

window.document.oncontextmenu = function () {
  return false;     // cancel default menu
};

window.addEventListener('resize', function () {
  // error: receiver is not initialized the first time loading the page.
  myVideoPlayer.resizeVideo();
}, true);

window.addEventListener('beforeunload', async () => {
  if (myVideoPlayer) {
    await myVideoPlayer.stop();
  }
}, true);

async function setup() {
  const res = await getServerConfig();
  useWebSocket = res.useWebSocket;
  showWarningIfNeeded(res.startupMode);
  //showPlayButton();
  Play();
}

function showWarningIfNeeded(startupMode) {
  const warningDiv = document.getElementById("warning");
  if (startupMode === "private") {
    warningDiv.innerHTML = "<h4>Warning</h4> This sample is not working on Private Mode.";
    warningDiv.hidden = false;
  }
}

// function showPlayButton() {
//   if (!document.getElementById('playButton')) {
//     let elementPlayButton = document.createElement('div');
//     elementPlayButton.id = 'playButtonElement';
//     //elementPlayButton.id = 'playButton';
//     //elementPlayButton.src = 'images/Play.png';
//     elementPlayButton.alt = 'Start Streaming';
//     elementPlayButton.title = "Click to Connect"
//     elementPlayButton.innerHTML = "<img id = playButton src = \"images/Play.png\"><span class=\"carousel-caption\">Click play to connect!</span>";
//     playButton = document.getElementById("video-players").appendChild(elementPlayButton);
//     playButton.addEventListener('click', onClickPlayButton);
//   }
// }

//function onClickPlayButton() {
function Play() {
  //playButton.style.display = 'none';

  // add video player (preview)
  const elementPreviewVideo = document.createElement('video');
  elementPreviewVideo.style.touchAction = 'none';
  elementPreviewVideo.style.display = "flex";
  elementPreviewVideo.id = 'preview-video';
  elementPreviewVideo.autoplay = true;
  elementPreviewVideo.muted = true;
  previewDiv.appendChild(elementPreviewVideo);

  // add video player (output)
  const elementOutputVideo = document.createElement('video');
  elementOutputVideo.style.touchAction = 'none';
  elementOutputVideo.style.display = 'flex';
  elementOutputVideo.id = 'output-video';
  elementOutputVideo.autoplay = true;
  elementOutputVideo.muted = true;
  outputDiv.appendChild(elementOutputVideo);

  elementPreviewVideo.load();
  elementOutputVideo.load();

  setupVideoPlayer([elementPreviewVideo, elementOutputVideo]).then(value => {
    myVideoPlayer = value;
    // Notify the control implementation that the video player is ready.
    mainNotifications.notifyVideoSetup();
  });

  // add mute button (mutes audio from the preview video)
  const elementMuteButton = document.createElement('button');
  elementMuteButton.id = 'mute-preview-btn';
  elementMuteButton.classList.add('btn');
  elementMuteButton.classList.add('btn-secondary');
  elementMuteButton.classList.add('btn-sm');
  // Make the button position relative to the bottom left of the playerDiv.
  elementMuteButton.style.position = 'absolute';
  elementMuteButton.style.bottom = '0.5em';
  elementMuteButton.style.left = '1.5em';
  elementMuteButton.innerHTML = 'Output Audio <i class="bi bi-volume-mute"></i>';
  elementMuteButton.addEventListener('click', function () {
    elementPreviewVideo.muted = false;
    let audioTracks = myVideoPlayer.videoAudioTracks;
    if (audioTracks.length !== 2) return;
    // Toggle first audio track.
    audioTracks[0].enabled = !audioTracks[0].enabled;
    elementMuteButton.innerHTML = audioTracks[0].enabled ? 'Output Audio <i class="bi bi-volume-up"></i>' : 'Output Audio <i class="bi bi-volume-mute"></i>';
  });
  outputColDiv.appendChild(elementMuteButton);

  // add second mute button (mutes zoom call audio)
  const elementMuteButton2 = document.createElement('button');
  elementMuteButton2.id = 'mute-zoom-btn';
  elementMuteButton2.classList.add('btn');
  elementMuteButton2.classList.add('btn-secondary');
  elementMuteButton2.classList.add('btn-sm');
  // Make the button position relative to the bottom left of the playerDiv.
  elementMuteButton2.style.position = 'absolute';
  elementMuteButton2.style.bottom = '0.5em';
  elementMuteButton2.style.left = '1.5em';
  elementMuteButton2.innerHTML = 'Input Audio <i class="bi bi-volume-mute"></i>';
  elementMuteButton2.addEventListener('click', function () {
    elementPreviewVideo.muted = false;
    let audioTracks = myVideoPlayer.videoAudioTracks;
    if (audioTracks.length !== 2) return;
    // Toggle second audio track.
    audioTracks[1].enabled = !audioTracks[1].enabled;
    elementMuteButton2.innerHTML = audioTracks[1].enabled ? 'Input Audio <i class="bi bi-volume-up"></i>' : 'Input Audio <i class="bi bi-volume-mute"></i>';
  });
  previewColDiv.appendChild(elementMuteButton2);

  /* NOTE: to reenable fullscreen. Uncomment this section.
  // add fullscreen button
  const elementFullscreenButton = document.createElement('img');
  elementFullscreenButton.id = 'fullscreenButton';
  elementFullscreenButton.src = 'images/FullScreen.png';
  playerDiv.appendChild(elementFullscreenButton);
  elementFullscreenButton.addEventListener("click", function () {
    if (!document.fullscreenElement || !document.webkitFullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
      } else {
        if (playerDiv.style.position == "absolute") {
          playerDiv.style.position = "relative";
        } else {
          playerDiv.style.position = "absolute";
        }
      }
    }
  });
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  document.addEventListener('fullscreenchange', onFullscreenChange);
    function onFullscreenChange() {
    if (document.webkitFullscreenElement || document.fullscreenElement) {
      playerDiv.style.position = "absolute";
      elementFullscreenButton.style.display = 'none';
    } else {
      playerDiv.style.position = "relative";
      elementFullscreenButton.style.display = 'block';
    }
  }
   */
}

async function setupVideoPlayer(previewElement, outputElement) {
  const videoPlayer = new VideoPlayer(previewElement, outputElement);
  let selectedCodecs = null;

  await videoPlayer.setupConnection(useWebSocket, selectedCodecs);
  videoPlayer.onconnect = onConnect;
  videoPlayer.ondisconnect = onDisconnect;

  return videoPlayer;
}

async function onConnect() {
  document.getElementById("general-status-bar").innerHTML = "Connection State: Connected"
}

async function onDisconnect(message) {
  // Clear generated elements.
  //playerDiv.removeChild(document.getElementById('playButtonElement'));
  outputDiv.removeChild(document.getElementById('output-video'));
  previewDiv.removeChild(document.getElementById('preview-video'));
  await myVideoPlayer.stop();
  myVideoPlayer = null;

  //showPlayButton();
  document.getElementById("meeting-number-input-field").disabled = false;
  document.getElementById("join-meeting-btn").disabled = false;
  document.getElementById("general-status-bar").innerHTML = "Connection State: Disconnected"
  Play();
}
