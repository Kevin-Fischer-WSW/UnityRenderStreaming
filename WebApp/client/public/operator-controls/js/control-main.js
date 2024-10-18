/*
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
  if (myVideoPlayer){
    myVideoPlayer.resizeVideo();
  }
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

  // setup mute buttons
  let muteOutputButton = document.getElementById('mute-output-btn');
  let muteInputButton = document.getElementById('mute-input-btn');
  let muteOutputSlider = document.getElementById('mute-output-slider');
  let muteInputSlider = document.getElementById('mute-input-slider');
  let muteOutputIcon = document.getElementById('mute-output-icon');
  let muteInputIcon = document.getElementById('mute-input-icon');

  muteOutputButton.classList.remove("d-none");
  muteInputButton.classList.remove("d-none");

  muteOutputButton.removeEventListener('click', function () { });
  muteOutputButton.addEventListener('click', function () {
    let elementPreviewVideo = document.getElementById('preview-video');
    elementPreviewVideo.muted = false;
    let audioTracks = myVideoPlayer.videoAudioTracks;
    if (audioTracks.length !== 2) return;
    // Toggle first audio track.
    audioTracks[0].enabled = !audioTracks[0].enabled;
    muteOutputIcon.classList.add(audioTracks[0].enabled ? "bi-volume-up" : "bi-volume-mute")
    muteOutputIcon.classList.remove(audioTracks[0].enabled ? "bi-volume-mute" : "bi-volume-up")
    muteOutputSlider.classList.add(audioTracks[0].enabled ? "d-block" : "d-none")
    muteOutputSlider.classList.remove(audioTracks[0].enabled ? "d-none" : "d-block")
  });
  muteOutputSlider.addEventListener('click', function (ev) {
    ev.stopPropagation();
  })

  muteInputButton.addEventListener('click', function () {
    let elementPreviewVideo = document.getElementById('preview-video');
    elementPreviewVideo.muted = false;
    let audioTracks = myVideoPlayer.videoAudioTracks;
    if (audioTracks.length !== 2) return;
    // Toggle second audio track.
    audioTracks[1].enabled = !audioTracks[1].enabled;
    muteInputIcon.classList.add(audioTracks[1].enabled ? "bi-volume-up" : "bi-volume-mute")
    muteInputIcon.classList.remove(audioTracks[1].enabled ? "bi-volume-mute" : "bi-volume-up")
    muteInputSlider.classList.add(audioTracks[1].enabled ? "d-block" : "d-none")
    muteInputSlider.classList.remove(audioTracks[1].enabled ? "d-none" : "d-block")
  });
  muteInputSlider.addEventListener('click', function (ev) {
    ev.stopPropagation();
  })
  muteOutputSlider.addEventListener('input', function () {
    let elementPreviewVideo = document.getElementById('preview-video');
    elementPreviewVideo.volume = muteOutputSlider.value / 100;
    muteInputSlider.value = muteOutputSlider.value;
  });
  muteInputSlider.addEventListener('input', function () {
    let elementPreviewVideo = document.getElementById('preview-video');
    elementPreviewVideo.volume = muteInputSlider.value / 100;
    muteOutputSlider.value = muteInputSlider.value;
  });
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
}

async function setupVideoPlayer(previewElement, outputElement) {
  const videoPlayer = new VideoPlayer(previewElement, outputElement);
  let selectedCodecs = null;

  await videoPlayer.setupConnection(useWebSocket, selectedCodecs);
  videoPlayer.pc.addEventListener("disconnect", onDisconnect);

  return videoPlayer;
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
  Play();
}
