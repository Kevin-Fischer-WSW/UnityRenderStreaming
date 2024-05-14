/*
This file contains the implementations of our controls, including zoom controls, participant management, stream settings
 and logging.
 */
import { OperatorControls } from "/operator-controls/js/control-map.gen.js";
import { sendClickEvent, sendStringSubmitEvent } from "/videoplayer/js/register-events.js";
import { myVideoPlayer, mainNotifications } from "/operator-controls/js/control-main.js";
import { ValidateClonesWithJsonArray } from "/operator-controls/js/validation-helper.js";
import * as SelectHelper from "../../js/select-helper.js";
import { unityFetch, unityPutJson } from "../../js/unity-fetch.js";
import * as v2api from "../../js/v2api.js";
import { getVideoThumb } from "../../js/video-thumbnail.js";
import { createUploadProgressTracker } from "../../js/progresstracker.js";
import { CropWidget } from "../../js/crop-widget.js";
import * as Feedback from "../../js/user-input-feedback-alert.js";
import { onEnableAdvancedSettings } from "./advancedSettings.js";
import * as StyleHelper from "./style-helper.js";

Feedback.setDefaultParentElement(document.getElementById("alert-container"));

mainNotifications.addEventListener('setup', function () {
  myVideoPlayer.onParticipantDataReceived = participantDataReceived;
  myVideoPlayer.onAppStatusReceived = appStatusReceived;
  myVideoPlayer.onStyleUpdateNotification = onStyleUpdateNotification;
  myVideoPlayer.onLogMessageNotification = onLogMessageNotification;
  myVideoPlayer.onNewMediaNotification = onNewMediaNotification;
  myVideoPlayer.onMusicPlaybackTimeReceived = onMusicPlaybackTimeReceived;
  myVideoPlayer.onVideoPlaybackTimeReceived = onVideoPlaybackTimeReceived;
  myVideoPlayer.onWrongPasswordNotification = onWrongPasswordNotification;
  myVideoPlayer.onRegistrationUrlReceived = onRegistrationUrlReceived;
  myVideoPlayer.onObsDbLevelNotification = onObsDbLevelNotification;
  myVideoPlayer.onZoomReferenceDbLevelNotification = onZoomReferenceDbLevelNotification;
  myVideoPlayer.signaling.addEventListener("message", async (e) => {
    onAlert(e.detail);
  });
  myVideoPlayer.addEventListener("dataChannelOpen", updateGeneralStatBar);
  myVideoPlayer.addEventListener("dataChannelClose", () => {
    appStatus = undefined;
    updateGeneralStatBar();
  });
  myVideoPlayer.addEventListener("dataChannelConnecting", updateGeneralStatBar);
  myVideoPlayer.addEventListener("dataChannelClosing", updateGeneralStatBar);
});

function onAlert(data) {
  let type = data.type;
  let message = data.message;
  switch (type) {
      case "error":
          Feedback.alertDanger(message);
          break;
      case "warning":
          Feedback.alertWarning(message);
          break;
      case "info":
          Feedback.alertInfo(message);
          break;
      case "success":
          Feedback.alertSuccess(message);
          break;
      case "reboot":
          // Clear body and display reboot message
          document.body.innerHTML = `<div class="d-flex justify-content-center align-items-center h-100">
        <div class="text-center text-white">
          <h1 class="display-1">Rebooting...</h1>
          <p class="lead">Please wait while the system reboots. You will be redirected to login.</p>
        </div>
      </div>`;
      // Ping server until it responds.
      setTimeout(extendUntilRebooted, 10000);

    async function extendUntilRebooted() {
      let result = await extend();
      if (!result.valid && result.exception === undefined) {
        alert("The system has rebooted! You're being redirected...");
        window.location = window.location.origin;
      } else {
        setTimeout(extendUntilRebooted, 1000);
      }
    }

      break;
  }
}

function onNewMediaNotification() {
  if (navSlideTabBtn.classList.contains("active")) {
    onSlideTabClicked();
  } else if (navMusicTabBtn.classList.contains("active")) {
    onMusicTabClicked();
  } else if (navVideoTabBtn.classList.contains("active")) {
    onVideoTabClicked();
  }
}

/* SIGN OUT MODAL */
// => DOM ELEMENTS
let signOutModal = document.getElementById("signout-modal");

// => EVENT LISTENERS
signOutModal.addEventListener('shown.bs.modal', function () {
  signOutModal.focus();
})

/* EXTEND (TEMPORARY) */
document.body.addEventListener("click", function () {

  setTimeout(async function () {
    let result = await extend();
    if (!result.valid && result.exception === undefined) {
      alert("Your session has expired! You're being redirected...");
      window.location = window.location.origin;
    }
  }, 700)
});

async function extend() {
  try {
    let resp = await fetch("/extend");
    if (resp.ok) {
      return await resp.json();
    } else {
      return {valid: false};
    }
  }
  catch (e) {
    return {valid: false, exception: e};
  }
}

/* PARTICIPANT ACTIONS ON VIDEO ELEMENT */
// => DOM ELEMENTS
let participantOnVidCtrlOg = document.getElementById("participant-on-vid-ctrl-og");
let previewVideoContainer = document.getElementById("preview-video-container");
let screenShareOnVidCtrlOg = document.getElementById("screen-share-on-vid-ctrl-og");

// => PRIMITIVE AND OTHER TYPES
let participantOnVidCtrls = [];

// => METHODS
function setupParticipantOnVidCtrl(node, idx) {
  let dragEl = document.querySelector(`div#${node.id} .participant-on-vid-drag`);
  let eyeEl = document.querySelector(`div#${node.id} .participant-on-vid-eye`);
  let earEl = document.querySelector(`div#${node.id} .participant-on-vid-ear`);
  let renameEl = document.querySelector(`div#${node.id} a[target="action-rename"]`);
  let showLtEl = document.querySelector(`div#${node.id} a[target="action-show-lt"]`);
  let maximizeEl = document.querySelector(`div#${node.id} a[target="action-maximize"]`);

  node.classList.remove("d-none");

  dragEl.ondragstart = (ev) => {
    currentlyDraggedPov = node;
  }

  dragEl.ondragover = (ev) => {
    ev.preventDefault();
  }

  dragEl.ondrop = (ev) => {
    ev.preventDefault();
    if (currentlyDraggedPov !== node) {
      let currentIdx = participantOnVidCtrls.indexOf(currentlyDraggedPov);
      let droppedIdx = participantOnVidCtrls.indexOf(node);
      let p1 = participantJsonParsed[currentIdx].id;
      let p2 = participantJsonParsed[droppedIdx].id;
      unityFetch(`/swapParticipants?participantId1=${p1}&participantId2=${p2}`, { method: "PUT" });
    }
  }

  if (appStatus !== undefined) {
    earEl.style.pointerEvents = appStatus.currentZoomAudioMethod === "mixed" ? "none" : "auto";
  }
  earEl.addEventListener("mousedown", function (ev) {
    let earElmy = ev.pageY;
    let initialVolume = participantJsonParsed[idx].volume;
    let p = participantJsonParsed[idx];
    let mouseMove = function (ev) {
      let str = p.id + "," + (initialVolume + (earElmy - ev.pageY) / 100);
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._SetParticipantVolume, str);
    }
    let mouseUp = function (ev) {
      window.removeEventListener("mousemove", mouseMove);
      window.removeEventListener("mouseup", mouseUp);
      if (earElmy === ev.pageY) {
        unityFetch(`/muteParticipantAudioSource?participantId=${p.id}&mute=${!p.mutedAudioSource}`, { method: "PUT" });
      }
    }
    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("mouseup", mouseUp);
  })

  earEl.addEventListener("wheel", function (ev) {
    ev.preventDefault();
    let p = participantJsonParsed[idx];
    let str = p.id + "," + (p.volume + (ev.deltaY > 0 ? -0.1 : 0.1));
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._SetParticipantVolume, str);
  })

  eyeEl.addEventListener("click", function () {
    let p = participantJsonParsed[idx];
    let str = p.id + "," + !p.visible;
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._ToggleParticipantVisibilityButton, str);
  })

  renameEl.addEventListener("click", function () {
    let p = participantJsonParsed[idx];
    participantName.value = p.name;
    participantTitle.value = p.title;
    participantToRename = idx;
  })

  showLtEl.addEventListener("click", function (ev) {
    ev.preventDefault();
    let p = participantJsonParsed[idx];
    let str = p.id.toString();
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._ToggleParticipantLowerThird, str);
  })
  
  maximizeEl.addEventListener("click", async function (ev) {
    ev.preventDefault();
    let p = participantJsonParsed[idx];
    if (appStatus.participantMaximized) {
      await v2api.put('/previewPanel', {
        ShowAllParticipants: true,
      });
    } else {
      await v2api.put('/previewPanel', {
        ExclusiveParticipantID: p.id,
      });
    }
  });
}

function setupScreenShareOnVidCtrl() {
  let eyeEl = screenShareOnVidCtrlOg.querySelector(`.participant-on-vid-eye`);
  /* Uncomment to reenable screen share volume control
  let earEl = screenShareOnVidCtrlOg.querySelector(`.participant-on-vid-ear`);

  earEl.addEventListener("mousedown", function (ev) {
    let earElmy = ev.pageY;
    let initialVolume = screenShareJsonParsed.volume;
    let mouseMove = function (ev) {
      let str = (initialVolume + (earElmy - ev.pageY) / 100).toString();
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._SetScreenShareVolume, str);
    }
    let mouseUp = function (ev) {
      window.removeEventListener("mousemove", mouseMove);
      window.removeEventListener("mouseup", mouseUp);
      if (earElmy === ev.pageY) {
        unityFetch(`/muteScreenShareAudioSource?mute=${!screenShareJsonParsed.mutedAudioSource}`, { method: "PUT" });
      }
    }
    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("mouseup", mouseUp);
  })

  earEl.addEventListener("wheel", function (ev) {
    ev.preventDefault();
    let str = (screenShareJsonParsed.volume + (ev.deltaY > 0 ? -0.1 : 0.1));
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._SetScreenShareVolume, str);
  })
   */

  eyeEl.addEventListener("click", function () {
    unityFetch(`/setScreenShareVisible?visible=${!screenShareJsonParsed.visible}`, { method: "PUT" });
  })
}
function validateParticipantOnVidCtrls() {
  let setupCtrl = function (clone) {
    setupParticipantOnVidCtrl(clone, participantOnVidCtrls.length - 1);
  }
  let validateCtrl = function (ctrl, data) {
    let earEl = ctrl.querySelector(`.participant-on-vid-ear`);
    let maximizeEl = ctrl.querySelector(`a[target="action-maximize"]`);
    if (appStatus !== undefined){
      earEl.style.pointerEvents = appStatus.currentZoomAudioMethod === "mixed" ? "none" : "auto";
      maximizeEl.innerHTML = appStatus.participantMaximized ? "Show hidden participants" : "Maximize";
    }
    ctrl.style.top = (100 * data.top) + "%";
    ctrl.style.left = (100 * data.left) + "%";
    ctrl.style.width = (100 * data.width) + "%";
  }
  ValidateClonesWithJsonArray(participantOnVidCtrlOg, previewVideoContainer, participantOnVidCtrls, setupCtrl, participantJsonParsed, validateCtrl);
}

function validateScreenShareOnVidCtrl(){
  let data = screenShareJsonParsed;
  if (data === undefined){
    screenShareOnVidCtrlOg.classList.add("d-none");
  }else{
    screenShareOnVidCtrlOg.classList.remove("d-none");
    screenShareOnVidCtrlOg.style.top = (100 * data.top) + "%";
    screenShareOnVidCtrlOg.style.left = (100 * data.left) + "%";
    screenShareOnVidCtrlOg.style.width = (100 * data.width) + "%";
  }
}

// => INIT(S)
setupScreenShareOnVidCtrl();

/* OUTPUT VIDEO CONTAINER CONTROLS */
// => DOM ELEMENTS
let toggleOutputPreviewBtn = document.getElementById("toggle-output-preview-btn");

// => METHODS
function onToggleOutputPreviewClick() {
  let on = appStatus.outputPreviewed;
  v2api.put('/previewPanel', {MimicOutputPanel: !on});
}

function updateToggleOutputPreviewBtn(appStatus) {
  if (appStatus.holdingSlide !== "none" || appStatus.videoIsShowing || appStatus.outputPreviewed) {
    let on = appStatus.outputPreviewed;
    toggleOutputPreviewBtn.classList.remove("d-none");
    toggleOutputPreviewBtn.innerHTML = on ? `Output Preview <i class="bi bi-eye"></i>` : `Output Preview <i class="bi bi-eye-slash"></i>`;
  } else {
    toggleOutputPreviewBtn.classList.add("d-none");
  }
}

/* DB LEVEL METERING */
// => DOM ELEMENTS
let outputDbLevelMeter = document.getElementById("output-db-meter");
let inputDbLevelMeter = document.getElementById("zoom-db-meter");
let outputGreenSegment = outputDbLevelMeter.querySelector(".green-meter-segment");
let outputYellowSegment = outputDbLevelMeter.querySelector(".yellow-meter-segment");
let outputRedSegment = outputDbLevelMeter.querySelector(".red-meter-segment");
let inputGreenSegment = inputDbLevelMeter.querySelector(".green-meter-segment");
let inputYellowSegment = inputDbLevelMeter.querySelector(".yellow-meter-segment");
let inputRedSegment = inputDbLevelMeter.querySelector(".red-meter-segment");

// => PRIMITIVE AND OTHER TYPES
let greenFillMax = 0.75;
let yellowFillMax = greenFillMax + 0.125;
let redFillMax = 1.0;
let decayRate = 0.5;

let peakOutput = -80.0;
let peakInput = -80.0;

// => METHODS
function onObsDbLevelNotification(data) {
  let split = data.split(",");
  let master = parseInt(split[0]);
  let zoom = parseInt(split[1]);
  if (master > peakOutput) peakOutput = master;
  if (zoom > peakInput) peakInput = zoom;
}

function onZoomReferenceDbLevelNotification(data) {
  let split = data.split(",");
  let zoom = parseInt(split[0]);
  let mute = split[1] === "True";

  if (zoom > peakInput) peakInput = zoom;
}

function updateDbLevels(){
  let masterFill = 1.0 - peakOutput / -80.0;
  let zoomFill = 1.0 - peakInput / -80.0;

  let masterGreenFill = Math.min(masterFill, greenFillMax);
  let masterYellowFill = Math.min(masterFill, yellowFillMax);
  let masterRedFill = Math.min(masterFill, redFillMax);

  let zoomGreenFill = Math.min(zoomFill, greenFillMax);
  let zoomYellowFill = Math.min(zoomFill, yellowFillMax);
  let zoomRedFill = Math.min(zoomFill, redFillMax);

  outputGreenSegment.style.top = `${100.0 - masterGreenFill * 100.0}%`;
  outputYellowSegment.style.top = `${100.0 - masterYellowFill * 100.0}%`;
  outputRedSegment.style.top = `${100.0 - masterRedFill * 100.0}%`;

  inputGreenSegment.style.top = `${100.0 - zoomGreenFill * 100.0}%`;
  inputYellowSegment.style.top = `${100.0 - zoomYellowFill * 100.0}%`;
  inputRedSegment.style.top = `${100.0 - zoomRedFill * 100.0}%`;
}

// => INIT(S)
setInterval(function () {
  peakOutput = Math.max(peakOutput - decayRate, -80.0);
  peakInput = Math.max(peakInput - decayRate, -80.0);
  updateDbLevels();
}, 12);

// => EVENT LISTENERS
toggleOutputPreviewBtn.addEventListener("click", onToggleOutputPreviewClick);

/* RENAME MODAL */
// => DOM ELEMENTS
let currentlyDraggedPov;
let participantName = document.getElementById("participant-rename-name");
let participantTitle = document.getElementById("participant-rename-title");
let renameButton = document.getElementById("rename-btn");
let renameModal = document.getElementById("rename-modal");

// => PRIMITIVE AND OTHER TYPES
let participantToRename;

// => EVENT LISTENERS
//TODO ALERT IF ANY ERRORS
renameButton.addEventListener("click", function () {
  let p = participantJsonParsed[participantToRename];
  let name = encodeURIComponent(participantName.value);
  let title = encodeURIComponent(participantTitle.value);
  unityFetch(`/setParticipantDisplayName?participantId=${p.id}&name=${name}&title=${title}`, { method: "PUT" });
});

renameModal.addEventListener('shown.bs.modal', function () {
  renameModal.focus();
});

/* ZOOM TAB */
// => DOM ELEMENTS
let meetingNoInput = document.getElementById("meeting-number-input");
let meetingNoInputField = document.getElementById("meeting-number-input-field");

// => EVENTS LISTENERS
meetingNoInput.addEventListener("change", () => {
  localStorage.setItem("urlOrNumber", meetingNoInput.value);
})

// => INIT(S)
meetingNoInput.value = localStorage.getItem("urlOrNumber");

/* RESET APP SETTINGS */
// => DOM ELEMENTS
let resetModal = document.getElementById("reset-modal");
let resetModalBtn = document.getElementById("reset-to-default")
let resetAppSettingsBtn = document.getElementById("resetAppSettings");

// => METHODS
function onClickResetAppSettings() {
  unityFetch("/resetAppSettings", { method: "DELETE" });
  FetchAllUploadedMediaAndUpdateDash();
}

// => EVENT LISTENERS
resetAppSettingsBtn.addEventListener("click", onClickResetAppSettings);

resetModal.addEventListener('shown.bs.modal', function () {
  resetModal.focus();
});

/* STREAM MODAL */
// => DOM ELEMENTS
const copyBtn = document.getElementById('clip');
const copyData = document.getElementById('kt_clipboard_4');

let boardData = document.getElementById('kt_clipboard_4');
let pwd = document.getElementById("password-input");
let streamKeyInput = document.getElementById("stream-key-input");
let streamKeySelect = document.getElementById("stream-key-select");
let streamAuthSettings = document.getElementById("stream-auth-settings");
let streamPrefModal = document.getElementById("stream-pref-modal");
let streamPrefAlerts = document.getElementById("stream-pref-alerts");
let streamSettingsFieldset = document.getElementById("stream-settings-fieldset");
let streamingApp = document.getElementById("serverAppSelect");
let streamingServerAdd = document.getElementById("serverAddressSelect");
let uname = document.getElementById("username-input");

let autoShowCheckbox = document.getElementById("auto-show-checkbox");
let autoMuteCheckbox = document.getElementById("auto-mute-checkbox");
let autoShowScreenShareCheckbox = document.getElementById("auto-show-screen-share-checkbox");

let saveSettingsBtn = document.getElementById("save-settings-btn");
let streamSettingsBtn = document.getElementById("stream-settings");

let confirmRebootBtn = document.getElementById("confirm-reboot-btn");

// => PRIMITIVE AND OTHER TYPES
var clipboard = new ClipboardJS(copyBtn, {
  container: streamPrefModal,
  copyData: copyData,
  text: function () {
    return copyData.innerHTML;
  }
});
let saveStreamPrefFlag = false;

// => METHODS
function flagStreamPrefChange() {
  saveStreamPrefFlag = true;
}

async function saveSettings() {
  if (saveStreamPrefFlag === true){
    await saveStreamPref();
  }

  unityFetch(`/enableOutputVideoByDefault?enable=${autoShowCheckbox.checked}`, {method: "PUT"});
  unityFetch(`/enableOutputAudioByDefault?enable=${!autoMuteCheckbox.checked}`, {method: "PUT"});
  unityFetch(`/enableOutputScreenShareByDefault?enable=${autoShowScreenShareCheckbox.checked}`, {method: "PUT"});
  await updateSettings();
  Feedback.alertSuccess("Settings saved.", streamPrefAlerts);
}

async function saveStreamPref() {
  saveStreamPrefFlag = false;
  if (streamKeySelect.value === "custom" && streamKeyInput.value === "") {
    Feedback.alertDanger("You must provide a value for stream key.", streamPrefAlerts);
    return;
  }
  if (uname.value === "") {
    Feedback.alertDanger("You must provide a value for username.", streamPrefAlerts);
    return;
  }
  if (pwd.value === "") {
    Feedback.alertDanger("You must provide a value for password.", streamPrefAlerts);
    return;
  }
  let streamKey = streamKeySelect.value === "custom" ? streamKeyInput.value : streamKeySelect.value;
  let resp = await unityFetch("/setStreamServiceSettings?" +
    "serverUrl=" + `rtmp://${streamingServerAdd.value}/${streamingApp.value}/` +
    "&streamKey=" + streamKey +
    "&username=" + uname.value +
    "&password=" + pwd.value,
    { method: "PUT" });
  if (!resp.ok) {
    Feedback.alertDanger(resp.statusText, streamPrefAlerts);
  }
  await updateSettings();
}

async function updateSettings() {
  let resp = await fetch("/streamkeys");
  let data = await resp.json();
  streamKeySelect.innerHTML = "";
  for (let i = 0; i < data.streamkeys.length; i++) {
    let streamKeyOption = SelectHelper.createOption(data.streamkeys[i], data.streamkeys[i]);
    streamKeySelect.appendChild(streamKeyOption);
  }
  let customOption = SelectHelper.createOption("custom", "Custom")
  streamKeySelect.appendChild(customOption);
  resp = await unityFetch("/getStreamServiceSettings");
  if (!resp.ok) {
    Feedback.alertDanger("Could not get stream service settings.", streamPrefAlerts);
  } else {
    let data = await resp.json();
    let url = data.streamServiceSettings.server.split("/");
    streamingServerAdd.value = url[2];
    streamingApp.value = url[3];
    let hasOption = SelectHelper.selectHasOption(streamKeySelect, data.streamServiceSettings.key);
    streamKeySelect.value = hasOption ? data.streamServiceSettings.key : "custom";
    streamKeyInput.value = data.streamServiceSettings.key;
    streamKeyInput.parentElement.style.display = hasOption ? "none" : "block";
    uname.value = data.streamServiceSettings.username;
    pwd.value = data.streamServiceSettings.password;
    boardData.innerHTML = url[3] === "none" ? "" : data.streamServiceSettings.server + data.streamServiceSettings.key;
  }
  resp = await unityFetch("/getAutomationSettings");
  if (resp.ok) {
    let data = await resp.json();
    autoShowCheckbox.checked = data.autoShowParticipantEnabled;
    autoMuteCheckbox.checked = data.autoMuteParticipantEnabled;
    autoShowScreenShareCheckbox.checked = data.autoShowScreenShareEnabled;
  }
}

function reboot() {
  fetch("/reboot", { method: "PUT" });
}

function onStreamKeySelectChanged() {
  if (streamKeySelect.value === "custom") {
    streamKeyInput.parentElement.style.display = "block";
    streamKeyInput.focus();
  } else {
    streamKeyInput.parentElement.style.display = "none";
  }
  flagStreamPrefChange();
}

// => EVENT LISTENERS
pwd.addEventListener("input", flagStreamPrefChange);
saveSettingsBtn.addEventListener("click", saveSettings);
streamingApp.addEventListener("input", flagStreamPrefChange);
streamKeyInput.addEventListener("input", flagStreamPrefChange);
streamKeySelect.addEventListener("change", onStreamKeySelectChanged);
streamingServerAdd.addEventListener("input", flagStreamPrefChange);
streamSettingsBtn.addEventListener("click", updateSettings);
uname.addEventListener("input", flagStreamPrefChange);

confirmRebootBtn.addEventListener("click", reboot);

clipboard.on('success', function (e) {
  var btnIcon = copyBtn.querySelector('.bi.bi-check');
  var svgIcon = copyBtn.querySelector('.svg-icon');

  if (btnIcon) {
    return;
  }
  btnIcon = document.createElement('i');
  btnIcon.classList.add('bi');
  btnIcon.classList.add('bi-check');
  btnIcon.classList.add('fs-2x');
  copyBtn.appendChild(btnIcon);

  copyData.classList.add('text-success');
  svgIcon.classList.add('d-none');

  setTimeout(function () {
    svgIcon.classList.remove('d-none');
    copyBtn.removeChild(btnIcon);
    copyData.classList.remove('text-success');
  }, 3000);
});

streamPrefModal.addEventListener('shown.bs.modal', function () {
  streamingServerAdd.focus();
})

/* GENERAL STATUS BAR */
// => DOM ELEMENTS
let statSessionTitle = document.getElementById("stat-session-title");
let statStreamKey = document.getElementById("stat-stream-key");
let statInMeeting = document.getElementById("stat-meeting");
let statOnAir = document.getElementById("stat-on-air");
let statRecording = document.getElementById("stat-recording");
let statAudio = document.getElementById("stat-audio");
let statVideo = document.getElementById("stat-video");
let statScene = document.getElementById("stat-scene");

// => METHODS
function updateGeneralStatBar() {
  if (appStatus !== undefined) {
    statSessionTitle.innerHTML = `Session: ${appStatus.sessionTitle}`;
    statStreamKey.innerHTML = `Stream Key: ${appStatus.streamKey}`;
    statInMeeting.innerHTML = `In Meeting: ${appStatus.inMeeting ? appStatus.meetingId : "No"}`;
    statOnAir.innerHTML = `<i id="on-air-indicator-icon" class="bi bi-broadcast"></i> On Air`;
    statOnAir.classList.add(appStatus.streaming ? "bg-success" : "bg-secondary");
    statOnAir.classList.remove(appStatus.streaming ? "bg-secondary" : "bg-success");
    statRecording.innerHTML = `Recording: ${appStatus.recording ? "Active" : "Inactive"}`;
    statScene.innerHTML = `Scene: ${appStatus.lastSceneLoaded}`;

    let videoSources = [];
    let audioSources = [];
    let audioConflict = false;

    /* check audio sources */
    if (!appStatus.masterAudioMuted && appStatus.masterVolume > 0.01) {
      if (appStatus.isAnyParticipantAudible) audioSources.push("Presenter");
      if (appStatus.isScreenShareAudible) audioSources.push("Screen Share");
      if (appStatus.playingHoldingMusic && appStatus.holdingMusicVolume > 0) {
        audioConflict = audioSources.length >= 1;
        audioSources.push("Holding music");
      }
      if (appStatus.playingVideo && appStatus.currentVideoVolume > 0) {
        audioConflict = audioSources.length >= 1;
        audioSources.push("Video playback");
      }
    }

    /* check video sources */
    if (appStatus.holdingSlide !== "none") videoSources.push(appStatus.holdingSlide.charAt(0).toUpperCase() + appStatus.holdingSlide.slice(1));
    else if (appStatus.videoIsShowing && appStatus.holdingSlide) videoSources.push("Video playback");
    else {
      if (appStatus.isAnyParticipantVisible && !appStatus.videoIsShowing && appStatus.holdingSlide === "none") videoSources.push("Presenter");
      if (appStatus.isScreenShareVisible && !appStatus.videoIsShowing && appStatus.holdingSlide === "none") videoSources.push("Screen Share");
    }

    /* update information */
    let warning = `<i class="bi bi-exclamation-triangle" title="Music/Video is playing over Presenters."></i>`
    statAudio.innerHTML = `Audio: ${audioConflict ? warning : ""} ${audioSources.length > 0 ? audioSources.join(", ") : "None"}`;
    statVideo.innerHTML = `Video: ${videoSources.length > 0 ? videoSources.join(", ") : "None"}`;
    //statScene.innerHTML = `Scene: ${appStatus.holdingSlide}`;
  } else {
    statSessionTitle.innerHTML = `Session: `;
    statStreamKey.innerHTML = `Stream Key: `;
    statInMeeting.innerHTML = `In Meeting: `;
    statOnAir.innerHTML = `Connection: ${myVideoPlayer.channel.readyState}`;
    statRecording.innerHTML = `Recording: `;
    statAudio.innerHTML = `Audio: `;
    statVideo.innerHTML = `Video: `;
    statScene.innerHTML = `Scene: `;
    if (myVideoPlayer.channel.readyState === "open"){
      setTimeout(updateGeneralStatBar, 1000);
      sendClickEvent(myVideoPlayer, OperatorControls._GetAppStatus);
    }
  }
}

/* STREAM BUTTONS */
// => DOM ELEMENTS
let previewIntroImg = document.getElementById("modal-img-preview");
let previewIntroImgCaption = document.getElementById("modal-img-caption");

let archiveBtn = document.getElementById("archive-btn");
let lateBtn = document.getElementById("late-btn");
let liveBtn = document.getElementById("live-btn");
let pendingBtn = document.getElementById("pending-btn");
let streamConfBtn = document.getElementById("stream-confirmation-btn");
let technicalDiffBtn = document.getElementById("technical-diff-btn");
let streamControlLoadSceneBtn = document.getElementById("stream-control-load-scene-btn");
let streamControlSceneDropdown = document.getElementById("stream-control-load-scene-dropdown");

archiveBtn.addEventListener("click", onArchiveClick);
liveBtn.addEventListener("click", onLiveClick);
lateBtn.addEventListener("click", onLateClick);
streamConfBtn.addEventListener("click", onPendingClick);
technicalDiffBtn.addEventListener("click", onTechnicalDiff);
streamControlLoadSceneBtn.addEventListener("click", onStreamControlLoadSceneBtnClicked);


// => METHODS
function onArchiveClick() {
  let sceneId = appStatus.lastSceneLoaded === "Conclusion" && appStatus.isCustomSlide === false ? "end" : "outro";
  loadScene(sceneId).then((result) => {
    if (result.success && sceneId === "end") {
      Feedback.alertSuccess("Success: Stream ended.");
    }
  });
}

function onLateClick() {
  let sceneId = appStatus.lastSceneLoaded !== "Late" ? "late" : "live";
  loadScene(sceneId).then((result) => {
    console.log(`Load late scene result: ${result}`);
  });
}

function onLiveClick() {
  loadScene("live").then((result) => {
    console.log(`Load live scene result: ${result}`);
  });
}

function onPendingClick() {
  let sceneId = appStatus.lastSceneLoaded !== "Intro" ? "intro" : "live";
  loadScene(sceneId).then((result) => {
    if (result.success && sceneId === "live") {
      Feedback.alertSuccess("Success: Stream started.");
    }
  });
}

async function onStreamControlLoadSceneBtnClicked() {
  await populateSceneDropdown(streamControlSceneDropdown, onLoadSceneSelected, true);
}

function onTechnicalDiff() {
  let sceneId = appStatus.lastSceneLoaded !== "Tech Diff" ? "techdiff" : "live";
  loadScene(sceneId).then((result) => {
    console.log(`Load technical difficulties scene result: ${result}`);
  });
}

async function loadScene(sceneId) {
  let result = {
    success: false,
  }
  v2api.put(`/scene/${sceneId}/load`).then((response) => {
    if (response.ok) {
      response.json().then((data) => {
        if (v2api.checkErrorCode(data, 0)) {
          result.success = true;
        } else if (v2api.checkErrorCode(16)) {
          Feedback.alertDanger("OBS failed to start the stream. Please check your settings and try again.");
        } else {
          let errors = v2api.getErrorMessagesAndResolutions(data);
          for (let i = 0; i < errors.errorMessages.length; i++) {
            Feedback.alertDanger(`${errors.errorMessages[i]} ${errors.resolutions[i]}`);
          }
        }
      });
    } else{
      response.json().then((data) => {
        console.log(data);
        let errors = v2api.getErrorMessagesAndResolutions(data);
        for (let i = 0; i < errors.errorMessages.length; i++) {
          let resolution = errors.resolutions[i] === undefined ? "" : errors.resolutions[i];
          Feedback.alertDanger(`${errors.errorMessages[i]} ${resolution}`);
        }
      }).catch((e) => {
        console.log(e);
      });
    }
  });
  return result;
}

function resetStreamButtonsOnLeaveOrEnd() {
  if (pendingBtn.innerHTML === "Intro Slide") pendingBtn.innerHTML = "Start Stream";
  if (streamSettingsFieldset.disabled) streamSettingsFieldset.disabled = false;
  if (!pendingBtn.classList.contains("rounded")) pendingBtn.classList.add("rounded");
  if (!liveBtn.classList.contains("d-none")) liveBtn.classList.add("d-none");
  if (!lateBtn.classList.contains("d-none")) lateBtn.classList.add("d-none");
  if (!technicalDiffBtn.classList.contains("d-none")) technicalDiffBtn.classList.add("d-none");
  if (!archiveBtn.classList.contains("d-none")) archiveBtn.classList.add("d-none");
  if (!pendingBtn.hasAttribute("data-bs-toggle")) pendingBtn.setAttribute("data-bs-toggle", "modal");
  if (!intro_preview.hasAttribute("data-bs-toggle")) intro_preview.setAttribute("data-bs-toggle", "modal");
  pendingBtn.removeEventListener("click", onPendingClick);
  intro_preview.removeEventListener("click", onPendingClick);
}

function updateStreamButtons() {
  streamSettingsFieldset.disabled = true;
  pendingBtn.innerHTML = "Intro Slide";
  liveBtn.innerHTML = "Live";
  lateBtn.innerHTML = "Late";
  technicalDiffBtn.innerHTML = "Technical Difficulties";
  archiveBtn.innerHTML = "Conclusion Slide";
  pendingBtn.classList.remove("rounded");
  liveBtn.classList.remove("d-none");
  lateBtn.classList.remove("d-none");
  technicalDiffBtn.classList.remove("d-none");
  archiveBtn.classList.remove("d-none");
  pendingBtn.removeAttribute("data-bs-toggle");
  pendingBtn.addEventListener("click", onPendingClick);
  intro_preview.removeAttribute("data-bs-toggle");
  intro_preview.addEventListener("click", onPendingClick);

  if (appStatus.lastSceneLoaded === "Intro") {
    pendingBtn.innerHTML = `Intro Slide <i class="bi bi-broadcast"></i>`;
    StyleHelper.ActivateButtonHelper(pendingBtn, true);
  } else if (appStatus.lastSceneLoaded === "Late") {
    lateBtn.innerHTML = `Late <i class="bi bi-broadcast"></i>`;
    StyleHelper.ActivateButtonHelper(lateBtn, true);
  } else if (appStatus.lastSceneLoaded === "Tech Diff") {
    technicalDiffBtn.innerHTML = `Technical Difficulties <i class="bi bi-broadcast"></i>`;
    StyleHelper.ActivateButtonHelper(technicalDiffBtn, true);
  } else if (appStatus.lastSceneLoaded === "Conclusion" && appStatus.isCustomSlide === false) {
    StyleHelper.ActivateButtonHelper(archiveBtn, true);
    archiveBtn.innerHTML = `End Stream <i class="bi bi-broadcast"></i>`;
  } else if (appStatus.holdingSlide === "none" || appStatus.isCustomSlide) {
    liveBtn.innerHTML = `Live <i class="bi bi-broadcast"></i>`;
    StyleHelper.ActivateButtonHelper(liveBtn, true);
  } else {
    resetStreamButtonsOnLeaveOrEnd();
  }
}


/* ZOOM CONTROLS */
// => DOM ELEMENTS
let joinMeetingBtn = document.getElementById("join-meeting-btn");
let leaveMeetingBtn = document.getElementById("leave-meeting-btn");
let meetingNumberInput = document.getElementById("meeting-number-input");
let meetingPasswordInput = document.getElementById("meeting-password-input");

// => METHODS
async function onJoinClick() {
  // Meeting number can also be entered as a URI. This is helpful since query parameters can be passed along with the meeting number.
  let resp = await v2api.put('/joinMeeting', {
    MeetingId: meetingNumberInput.value,
    Password: meetingPasswordInput.value
  });
  if (resp.ok) {
    let data = await resp.json();
    if (v2api.checkErrorCode(data, 0)) {
      Feedback.alertSuccess("Meeting joined.");
    } else {
      console.error(data);
    }
  }
}

function onMeetingNumberInputClick() {
  // Select all text in the input field when clicked
  meetingNumberInput.select();
}

async function onLeaveClicked() {
  let resp = await v2api.put('/leaveMeeting');
  if (resp.ok) {
    let data = await resp.json();
    if (v2api.checkErrorCode(data, 0)) {
      Feedback.alertSuccess("Meeting left.");
    } else {
      console.error(data);
    }
  }
}

function onRegistrationUrlReceived(url) {
  let a = document.getElementById("registration-url");
  a.href = url;
  a.innerText = url;
  $('#registration-url-modal').modal('show');
}

function onWrongPasswordNotification() {
  Feedback.alertDanger("Meeting password is incorrect.");
}

// => EVENT LISTENERS
meetingNumberInput.addEventListener('click', onMeetingNumberInputClick);
joinMeetingBtn.addEventListener('click', onJoinClick);
leaveMeetingBtn.addEventListener("click", onLeaveClicked);


/* PARTICIPANTS TAB */
// => DOM ELEMENTS
let allParticipantsDiv = document.getElementById("all-participants-div");
let currentlyDraggedP;
let participantFieldset = document.getElementById("participant-fieldset");
let participantsGroupLabelDiv = document.getElementById("ppt-grp-input-div");
let participantsGroupLabelInput = document.getElementById("ppt-grp-label-name");
let participantsGroupSelect = document.getElementById("ppt-group-select");
let participantInputGroupOg = document.getElementById("participant-input-group");

let deleteGroupBtn = document.getElementById("delete-grp-btn");
let groupParticipantsBtn = document.getElementById("group-select-ppt-btn");
let hideAllLowerThirdsBtn = document.getElementById("hide-all-lower-thirds-btn");
let hideSelectParticipantBtn = document.getElementById("hide-select-ppt-btn");
let participantsGroupLabelSubmitBtn = document.getElementById("ppt-grp-label-submit");
let removeParticipantsBtn = document.getElementById("remove-select-ppt-btn");
let selectAllParticipantBtn = document.getElementById("check-uncheck-all-ppt-btn");
let showAllLowerThirdsBtn = document.getElementById("show-all-lower-thirds-btn");
let showSelectParticipantBtn = document.getElementById("show-select-ppt-btn");

// => PRIMITIVE AND OTHER TYPES
let participantInputGroups = [];
let participantJsonParsed = null;
let groupJsonParsed = null;
let screenShareJsonParsed = null;

// => METHODS
function addParticipantSelectCheckEventListener() {
  let cbs = document.getElementsByName('checked-participant');
  for (let i = 0; i < cbs.length; i++) {
    cbs[i].addEventListener('change', updateSelectParticipantBtnText);
  }
}

function ClearAnySelectedParticipants() {
  selectAllParticipantBtn.innerHTML = "Select All";
  let selectedParticipants = mapSelectParticipantsToInputGroups();

  for (let i = 0; i < selectedParticipants.length; i++) {
    selectedParticipants[i].checked = false;
  }

  if (!groupParticipantsBtn.disabled) groupParticipantsBtn.disabled = true;
}

function displayParticipantsInGroup() {
  // the below code allows to display members of group only, if a group is selected.

  // By default, we unhide all members and only hide if a group is selected
  // Why? If this is not done prior to hiding members upon a selection,
  // the code fails to list members accordingly, between selections.
  let grp = participantsGroupSelect.value;
  for (let i = 0; i < participantJsonParsed.length; i++) {
    if (participantInputGroups[i].classList.contains('d-none')) participantInputGroups[i].classList.remove('d-none');
  }

  if (grp !== "default") {
    let index = groupJsonParsed.findIndex((i) => i.group === grp); // finds index to access members of specific group.
    let selectedParticipants = mapSelectParticipantsToInputGroups();

    for (let i = 0; i < selectedParticipants.length; i++) {
      if (!selectedParticipants[i].checked
        && !groupJsonParsed[index].participants.includes(participantJsonParsed[i].id)
        && !participantInputGroups[i].classList.contains('d-none')) participantInputGroups[i].classList.add('d-none');
    }
  }
}

function hideGroupElementsOnSelectNone() {
  groupParticipantsBtn.disabled = true;
  participantsGroupLabelInput.value = "";
  participantsGroupLabelDiv.classList.add("d-none");
}

function groupParticipants() {
  participantsGroupLabelDiv.classList.add("d-none");

  let participants = mapSelectParticipantsToInputGroups();
  let selectedParticipants = []
  for (let i = 0; i < participants.length; i++) {
    if (participants[i].checked) {
      selectedParticipants.push(participantJsonParsed[i].id);
    }
  }
  let groupId = participantsGroupLabelInput.value;
  unityFetch(`/createParticipantsGroup?groupId=${groupId}&participantId=${selectedParticipants.join()}`, { method: "PUT" })
    .then((resp) => {
      if (resp.ok) {
        Feedback.alertSuccess("Success: Created group " + groupId);
      }
      ClearAnySelectedParticipants();
      participantsGroupLabelInput.value = "";
    });
}

function listParticipantsGroups() {
  if (participantsGroupSelect.childElementCount > groupJsonParsed.length + 1) {
    while (participantsGroupSelect.childElementCount > groupJsonParsed.length + 1) {
      participantsGroupSelect.removeChild(participantsGroupSelect.lastChild);
    }
  } else {
    while (participantsGroupSelect.childElementCount < groupJsonParsed.length + 1) {
      let option = document.createElement("option");
      participantsGroupSelect.appendChild(option);
    }
  }

  for (let i = 0; i < groupJsonParsed.length; i++) {
    let group = groupJsonParsed[i].group;
    let option = participantsGroupSelect.children[i + 1];
    option.value = option.innerText = group;
  }
}

function mapSelectParticipantsToInputGroups() {
  let arr = participantInputGroups.map(group => {
    return group.querySelector(".check");
  });
  return arr;
}

function onDeleteGroupBtnClicked() {
  unityFetch(`/deleteParticipantsGroup?groupId=${participantsGroupSelect.value}`, { method: "DELETE" })
    .then((resp) => {
      if (resp.ok) {
        Feedback.alertSuccess("Success: Deleted group " + participantsGroupSelect.value);
        participantsGroupSelect.value = "default";
        groupParticipantsBtn.classList.remove("d-none");
        if (!deleteGroupBtn.classList.contains("d-none")) deleteGroupBtn.classList.add("d-none");
        if (!removeParticipantsBtn.classList.contains("d-none")) removeParticipantsBtn.classList.add("d-none");
        displayParticipantsInGroup();
      }
    });
}

function onHideAllLowerThirdsClick() {
  sendClickEvent(myVideoPlayer, OperatorControls._HideAllLowerThirds);
}

function onShowAllLowerThirdsClick() {
  sendClickEvent(myVideoPlayer, OperatorControls._ShowAllLowerThirds);
}

function onParticipantGroupSelectChanged() {
  ClearAnySelectedParticipants(); // clear any selections

  if (participantsGroupSelect.value !== "default") {
    groupParticipantsBtn.classList.add("d-none");
    if (deleteGroupBtn.classList.contains("d-none")) deleteGroupBtn.classList.remove("d-none");
    if (removeParticipantsBtn.classList.contains("d-none")) removeParticipantsBtn.classList.remove("d-none");
  } else {
    groupParticipantsBtn.classList.remove("d-none");
    deleteGroupBtn.classList.add("d-none");
    removeParticipantsBtn.classList.add("d-none");
  }

  displayParticipantsInGroup();
}

function onParticipantGroupSelectClicked() {
  if (!groupJsonParsed) return;
  listParticipantsGroups();
}

function onRemoveParticipantBtnClicked() {
  let participants = mapSelectParticipantsToInputGroups();
  let selectedParticipants = []
  for (let i = 0; i < participants.length; i++) {
    if (participants[i].checked) {
      participantInputGroups[i].classList.add("d-none");
      selectedParticipants.push(participantJsonParsed[i].id);
    }
  }

  ClearAnySelectedParticipants();
  unityFetch(`/removeParticipantsFromGroup?groupId=${participantsGroupSelect.value}&participantId=${selectedParticipants}`, { method: "DELETE" })
    .then((resp) => {
      if (resp.ok) {
        Feedback.alertSuccess("Success: Removed selected participants from the group.");
      }
    });
}

function participantDataReceived(json) {
  let data = JSON.parse(json);
  participantJsonParsed = data["ParticipantsData"];
  groupJsonParsed = data["GroupsData"];
  screenShareJsonParsed = data["ScreenShareDisplayData"];
  validateParticipantInputGroups();
  validateParticipantOnVidCtrls();
  validateScreenShareOnVidCtrl();
}

function setupParticipantInputGroup(node) {
  node.style.display = "flex";
  let idx = participantInputGroups.length - 1;
  let renameBtn = document.querySelector("div#" + node.id + " .rename-btn");
  let visibilityBtn = document.querySelector("div#" + node.id + " .visibility-btn");
  let lowerThirdBtn = document.querySelector("div#" + node.id + " .show-lower-third-btn");

  node.ondragstart = (ev) => {
    currentlyDraggedP = node;
    ClearAnySelectedParticipants();
  }

  node.ondragover = (ev) => {
    ev.preventDefault();
  }

  node.ondrop = (ev) => {
    ev.preventDefault();
    if (node !== currentlyDraggedP) {
      let droppedIdx = 0, currentIdx = 0;
      for (let i = 0; i < participantInputGroups.length; i++) {
        if (currentlyDraggedP === participantInputGroups[i]) {
          currentIdx = i;
        }
        if (node === participantInputGroups[i]) {
          droppedIdx = i;
        }
      }
      let p1 = participantJsonParsed[currentIdx].id;
      let p2 = participantJsonParsed[droppedIdx].id;
      unityFetch(`/swapParticipants?participantId1=${p1}&participantId2=${p2}`, { method: "PUT" });
    }
  }

  visibilityBtn.addEventListener("click", function () {
    let p = participantJsonParsed[idx];
    let str = p.id + "," + !p.visible;
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._ToggleParticipantVisibilityButton, str);
  })

  lowerThirdBtn.addEventListener("click", function () {
    let p = participantJsonParsed[idx];
    let str = p.id.toString();
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._ToggleParticipantLowerThird, str);
  })

  renameBtn.addEventListener("click", function () {
    let p = participantJsonParsed[idx];
    participantName.value = p.name;
    participantTitle.value = p.title;
    participantToRename = idx;
  })
}

function updateSelectParticipantBtnText() {
  let counter = 0;
  let selectedParticipants = mapSelectParticipantsToInputGroups();
  if (participantsGroupSelect.value === "default") groupParticipantsBtn.disabled = false;

  for (let i = 0; i < selectedParticipants.length; i++) {
    if (selectedParticipants[i].checked) {
      counter++;
    }
  }

  if (counter === selectedParticipants.length) {
    selectAllParticipantBtn.innerHTML = "Unselect All";
  } else {
    selectAllParticipantBtn.innerHTML = "Select All";
  }

  if (counter === 0) {
    // if participants selection is none
    hideGroupElementsOnSelectNone();
  }
}

function validateGroupLabel() {
  if (participantsGroupLabelInput.value !== "") {
    participantsGroupLabelSubmitBtn.disabled = false;
  } else {
    participantsGroupLabelSubmitBtn.disabled = true;
  }
}

function validateParticipantInputGroups() {
  let validateParticipantInputGroup = function (clone, data) {
    let visibilityBtn = document.querySelector(`#${clone.id} .visibility-btn`);
    let lowerThirdBtn = document.querySelector(`#${clone.id} .show-lower-third-btn`);
    let nameSpan = document.querySelector(`#${clone.id} .name-span`);

    visibilityBtn.firstChild.className = data.visible ? "bi bi-eye-fill" : "bi bi-eye-slash";
    lowerThirdBtn.firstChild.className = data.lowerThirdShowing ? "bi bi-person-vcard-fill" : "bi bi-person-vcard";
    if (data.title === "") {
      nameSpan.innerHTML = `<b>${data.name}</b>`;
    } else {
      nameSpan.innerHTML = `<b>${data.name}</b>&nbsp-&nbsp<i>${data.title}</i>`;
    }
  }
  ValidateClonesWithJsonArray(participantInputGroupOg, allParticipantsDiv, participantInputGroups, setupParticipantInputGroup, participantJsonParsed, validateParticipantInputGroup);
}

// => EVENT LISTENERS
deleteGroupBtn.addEventListener("click", onDeleteGroupBtnClicked);
hideAllLowerThirdsBtn.addEventListener("click", onHideAllLowerThirdsClick);
participantsGroupLabelInput.addEventListener("input", validateGroupLabel);
participantsGroupLabelSubmitBtn.addEventListener("click", groupParticipants);
participantsGroupSelect.addEventListener("click", onParticipantGroupSelectClicked);
participantsGroupSelect.addEventListener("change", onParticipantGroupSelectChanged);
removeParticipantsBtn.addEventListener("click", onRemoveParticipantBtnClicked);
showAllLowerThirdsBtn.addEventListener("click", onShowAllLowerThirdsClick);

groupParticipantsBtn.addEventListener("click", () => {
  //TODO: reimplement the logic for this btn
  participantsGroupLabelDiv.classList.remove("d-none");
});

hideSelectParticipantBtn.addEventListener("click", () => {
  let selectedParticipants = mapSelectParticipantsToInputGroups();
  for (let i = 0; i < selectedParticipants.length; i++) {
    if (selectedParticipants[i].checked && !participantInputGroups[i].classList.contains('d-none')) {
      let p = participantJsonParsed[i];
      let str = p.id + ",false";
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._ToggleParticipantVisibilityButton, str);
    }
  }
});

selectAllParticipantBtn.addEventListener("click", () => {

  if (selectAllParticipantBtn.innerHTML === "Select All") {
    selectAllParticipantBtn.innerHTML = "Unselect All";
    groupParticipantsBtn.disabled = false;
    let selectedParticipants = mapSelectParticipantsToInputGroups();

    for (let i = 0; i < selectedParticipants.length; i++) {
      selectedParticipants[i].checked = true;
    }
  } else if (selectAllParticipantBtn.innerHTML === "Unselect All") {
    selectAllParticipantBtn.innerHTML = "Select All";
    groupParticipantsBtn.disabled = true;
    let selectedParticipants = mapSelectParticipantsToInputGroups();

    for (let i = 0; i < selectedParticipants.length; i++) {
      selectedParticipants[i].checked = false;
    }
  }
});

showSelectParticipantBtn.addEventListener("click", () => {
  let selectedParticipants = mapSelectParticipantsToInputGroups();
  for (let i = 0; i < selectedParticipants.length; i++) {
    if (selectedParticipants[i].checked && !participantInputGroups[i].classList.contains('d-none')) {
      let p = participantJsonParsed[i];
      let str = p.id + ",true";
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._ToggleParticipantVisibilityButton, str);
    }
  }
})

// => INIT(S)
groupParticipantsBtn.disabled = true;
participantsGroupLabelSubmitBtn.disabled = true;
participantInputGroupOg.style.display = "none";


/* LAYOUT TAB */
// => DOM ELEMENTS
let cropScreenSharePreview = document.getElementById("crop-screen-share-preview");
let editStyleSelect = document.getElementById("edit-style-select");
let layoutFieldset = document.getElementById("layout-fieldset");
let layoutDropdown = document.getElementById("layout-dropdown");
let lowerThirdStyleBtn = document.getElementById("lower-thirds-style-btn");
let lowerThirdStyleDropdown = document.getElementById("lower-thirds-style-dropdown");
let textSizeDropdown = document.getElementById("text-size-dropdown");
let screenShareSizeDropdown = document.getElementById("screen-share-size-dropdown");
let cropScreenShareBtn = document.getElementById("crop-screen-share-btn");
let cropScreenShareApplyBtn = document.getElementById("crop-screen-share-apply-btn");
let cropScreenShareCloseBtn = document.getElementById("crop-screen-share-close-btn");

// => PRIMITIVE AND OTHER TYPES
let styleData = undefined;
let cropWidget = new CropWidget(cropScreenSharePreview);

// => METHODS
function fetchStyleData() {
  v2api.get("/styles").then((response) => {
    if (response.ok && styleData === undefined) {
      response.json().then((data) => {
        styleData = data;
        populateLowerThirdStyleDropdown();
        populateStyleEditorDropdown();
        populateSceneLayoutTypeSelectAndGenerateLayoutCategoryEditor();
      });
    }
  });
}

function populateLowerThirdStyleDropdown() {
  // Access the lower third category.
  let lowerThirdCategory = styleData["Categories"]["lowerthirds"];
  // Clear the lower third style dropdown.
  lowerThirdStyleDropdown.innerHTML = "";
  // Iterate through the lower third styles.
  Object.keys(lowerThirdCategory["Types"]).forEach((lowerThirdType) => {
    // Create a list item for the lower third style.
    let lowerThirdTypeLi = document.createElement("li");
    let lowerThirdTypeA = document.createElement("a");
    lowerThirdTypeA.classList.add("dropdown-item");
    lowerThirdTypeA.innerHTML = lowerThirdCategory["Types"][lowerThirdType]["Alias"];
    lowerThirdTypeLi.appendChild(lowerThirdTypeA);
    lowerThirdTypeLi.dataset.type = lowerThirdType;
    lowerThirdStyleDropdown.appendChild(lowerThirdTypeLi);
  });

  setupDropdown(lowerThirdStyleDropdown, onLowerThirdStyleSelected);
}

function populateStyleEditorDropdown() {
  // Clear the dropdown.
  editStyleSelect.innerHTML = "";
  // Iterate through the Categories.
  Object.keys(styleData["Categories"]).forEach((category) => {
    // Create an option for the category.
    let categoryOption = document.createElement("option");
    categoryOption.value = category;
    categoryOption.dataset.category = category;
    // todo make this bold. strong tag is not working.
    categoryOption.innerHTML = `<strong>${styleData["Categories"][category]["Alias"]}</strong>`;
    editStyleSelect.appendChild(categoryOption);

    // Iterate through the Types.
    Object.keys(styleData["Categories"][category]["Types"]).forEach((type) => {
      // Create an option for the type.
      let typeOption = document.createElement("option");
      typeOption.value = type;
      typeOption.dataset.type = type;
      typeOption.dataset.category = category;
      typeOption.innerHTML = styleData["Categories"][category]["Types"][type]["Alias"];
      editStyleSelect.appendChild(typeOption);
    });
  });
}

function onLowerThirdStyleBtnPressed() {
  if (styleData === undefined){
    lowerThirdStyleDropdown.innerHTML = "<li>Loading...</li>";
    fetchStyleData();
  }
}

function onEditStyleSelectClicked() {
  if (styleData === undefined){
    editStyleSelect.innerHTML = "<option>Loading...</option>";
    fetchStyleData();
  }
}

function onCropScreenShareApplyBtnClicked() {
  let crop = cropWidget.getNormalizedCrop();
  unityFetch(`/cropScreenShare?x=${crop.left}&y=${crop.bottom}&w=${crop.width}&h=${crop.height}`, { method: "PUT" })
    .then(resp => {
      if (resp.ok) {
        console.log("crop applied");
      } else {
        Feedback.alertDanger("Failed to crop screen share image");
      }
      // Dismiss the crop modal.
      cropScreenShareCloseBtn.click();
    });
}

function onCropScreenShareBtnClicked() {
  cropScreenSharePreview.src = "uapp/getScreenShareImage?t=" + Date.now();
}

async function onLayoutSelected(elem) {
  // Gather data from the selected layout. Values can be undefined.
  let videosTop = elem.dataset.videosTop;
  let videosLeft = elem.dataset.videosLeft;

  // Convert to true, false, or null (if undefined).
  let screenShareTop = videosTop === "false" ? true : videosTop === "true" ? false : null;
  let screenShareLeft = videosLeft === "false" ? true : videosLeft === "true" ? false : null;

  await v2api.put(`/style/layouts`, {
    "PreferScreenShareTop" : screenShareTop,
    "PreferScreenShareLeft" : screenShareLeft,
  });
  await v2api.put(`/style/layouts/${elem.dataset.type}/load`)
}

function onTextSizeSelected(elem) {
  // Gather data from the selected layout. Values can be undefined.
  let textSize = elem.dataset.value;

  v2api.put(`/style/lowerthirds`, {
    "DisplayOption" : textSize,
  });
}

function onScreenShareSizeSelected(elem) {
  // Gather data from the selected layout. Values can be undefined.
  let size = elem.dataset.value;

  v2api.put(`/style/layouts`, {
    "ScreenShareSize" : size,
  });
}

function onLowerThirdStyleSelected(elem) {
  v2api.put(`/style/lowerthirds/${elem.dataset.type}/load`);
}

function setupDropdown(dropdown, func) {
  for (let i = 0; i < dropdown.children.length; i++) {
    let child = dropdown.children[i]
    child.firstChild.onclick = function () {
      func(child)
    }
  }
}

function updateCurrentLayout(layoutType, preferScreenShareTop, preferScreenShareLeft) {
  StyleHelper.IterateListAndSetItemBold(layoutDropdown, function (child) {
    let b1 = child.dataset.type === layoutType;

    switch (layoutType) {
      case "hScreenShare":
      case "vScreenShare":
        let b2 = child.dataset.videosTop === (!preferScreenShareTop).toString();
        let b3 = child.dataset.videosLeft === (!preferScreenShareLeft).toString();
        return b1 && (b2 || b3);
    }

    return b1;
  });
}

function updateCurrentLowerThirdStyle(styleType) {
  StyleHelper.IterateListAndSetItemBold(lowerThirdStyleDropdown, function (child) {
    return child.dataset.type === styleType;
  });
}

function updateCurrentScreenShareStyleSize(size) {
  StyleHelper.IterateListAndSetItemBold(screenShareSizeDropdown, function (child) {
    return child.dataset.value === size;
  });
}

function updateCurrentTextSize(textSize)
{
  StyleHelper.IterateListAndSetItemBold(textSizeDropdown, function (child) {
    return child.dataset.value === textSize; // todo reimplement this
  });
}

// => EVENT LISTENERS
cropScreenShareBtn.addEventListener("click", onCropScreenShareBtnClicked);
cropScreenShareApplyBtn.addEventListener("click", onCropScreenShareApplyBtnClicked);
editStyleSelect.addEventListener("click", onEditStyleSelectClicked);
editStyleSelect.addEventListener("change", editStyleSelectionChanged);
lowerThirdStyleBtn.addEventListener("click", onLowerThirdStyleBtnPressed);

cropScreenSharePreview.onload = function () {
  cropWidget.mainElement.style.display = "block";
  setTimeout(() => {
    cropWidget.reset();
  }, 100);
  cropScreenSharePreview.alt = "Screen share image";
  cropScreenShareApplyBtn.disabled = false;
}

cropScreenSharePreview.onerror = function () {
  cropWidget.mainElement.style.display = "none";
  cropScreenSharePreview.alt = "No screen share image available";
  cropScreenShareApplyBtn.disabled = true;
}

// => INIT(S)
cropScreenSharePreview.parentElement.appendChild(cropWidget.mainElement);
cropWidget.initResizers();
setupDropdown(layoutDropdown, onLayoutSelected);
setupDropdown(textSizeDropdown, onTextSizeSelected);
setupDropdown(screenShareSizeDropdown, onScreenShareSizeSelected)

/* LAYOUT TAB -SCHEMA EDITOR */
// => DOM ELEMENTS
let layout_element = document.getElementById('layout-schema-editor');
let layout_editor;

// => METHODS

function anyValuesSetToNull(data) {
  for (let key in data) {
    if (data[key] === null) {
      return true;
    }
  }
  return false;
}

async function editStyleSelectionChanged() {
  // Access the selected option.
  let selectedOption = editStyleSelect.options[editStyleSelect.selectedIndex];
  // Access the category and type.
  let category = selectedOption.dataset.category;
  let type = selectedOption.dataset.type;

  await refreshStyleEditor(category, type);
}

async function refreshStyleEditor(category, type) {
  // If type is undefined, then the category was selected.
  if (type === undefined) {
    // Access the schema for the category.
    let schemaCopy = JSON.parse(JSON.stringify(styleData["Categories"][category]["Schema"]));

    // Fetch the current style data.
    let resp = await v2api.get(`/style/${category}`);
    let style = await resp.json();

    let anyNull = anyValuesSetToNull(style.Data);
    if (anyNull === false) {
      trimNullFromSchema(schemaCopy);
    }
    generateEditor(schemaCopy, style.Data);
  } else {
    // Access the schema for the type.
    let schemaCopy = JSON.parse(JSON.stringify(styleData["Categories"][category]["Types"][type]["Schema"]));

    // Fetch the current style data.
    let resp = await v2api.get(`/style/${category}/${type}`);
    let style = await resp.json();

    let anyNull = anyValuesSetToNull(style.Data);
    if (anyNull === false) {
      trimNullFromSchema(schemaCopy);
    }
    generateEditor(schemaCopy, style.Data);
  }

  function generateEditor(schema, startval) {
    if (layout_editor) {
      layout_editor.destroy();
    }

    layout_editor = new JSONEditor(layout_element, {
      schema: schema,
      theme: 'bootstrap4',
      startval: startval,
    });

    layout_editor.on('ready', () => {
      // Now the api methods will be available
      validateSchema();
    });

    // layout_editor emits a change event immediately unless we wait a bit.
    setTimeout(() => {
      layout_editor.on('change', onLayoutEditorChanged);
    }, 1000);
  }

  function trimNullFromSchema(schema) {
    // Iterate over the properties.
    for (let property in schema.properties) {
      // Access the property.
      let prop = schema.properties[property];
      // Get the list of types.
      let types = prop.type;
      // If the types is an array, then iterate over the types.
      if (Array.isArray(types)) {
        // Iterate over the types.
        for (let i = 0; i < types.length; i++) {
          // If the type is "null", then remove it.
          if (types[i] === "null") {
            types.splice(i, 1);
            // Check if the types array is one element long.
            if (types.length === 1) {
              // Set the type to the first element.
              prop.type = types[0];
            }
          }
        }
      }
    }
  }
}

async function onLayoutEditorChanged() {
  editStyleSelect.disabled = true;

  await saveStyle();
  editStyleSelect.disabled = false;
}

async function saveStyle() {
  layout_editor.disable();
  layout_editor.off('change', onLayoutEditorChanged);
  await performApiCalls();
  layout_editor.enable();
  setTimeout(() => {
    layout_editor.on('change', onLayoutEditorChanged);
  }, 1000);

  async function performApiCalls() {
    if (validateSchema()) {
      Feedback.alertInfo("Saving style...");

      let data = layout_editor.getValue();
      let category = editStyleSelect.options[editStyleSelect.selectedIndex].dataset.category;
      let type = editStyleSelect.options[editStyleSelect.selectedIndex].dataset.type;

      if (type === undefined) {
        let resp1 = await v2api.put(`/style/${category}`, data);
        if (resp1.ok === false) {
          Feedback.alertDanger("Failed to save style");
          return;
        }

        let resp2 = await v2api.get(`/style/${category}`);
        if (resp2.ok === false) {
          Feedback.alertDanger("Failed to retrieve style");
          return;
        }

        let style = await resp2.json();
        layout_editor.setValue(style.Data);
      } else {
        let resp1 = await v2api.put(`/style/${category}/${type}`, data);
        if (resp1.ok === false) {
          Feedback.alertDanger("Failed to save style");
          return;
        }

        let resp2 = await v2api.get(`/style/${category}/${type}`);
        if (resp2.ok === false) {
          Feedback.alertDanger("Failed to retrieve style");
          return;
        }

        let style = await resp2.json();
        layout_editor.setValue(style.Data);
      }
    }
  }
}

function validateSchema() {

  const err = layout_editor.validate();

  if (err.length) {
    console.log(err); //if the schema is invalid
    return false;
  }
  return true;
}

function onStyleUpdateNotification(msg) {
  let split = msg.split(",");

  // If the split is length 1, then a category was updated.
  if (split.length === 1) {
    let category = split[0];
    let type = undefined;

    // Refresh the editor if the selected style is in the same category.
    if (editStyleSelect.options[editStyleSelect.selectedIndex].dataset.category === category) {
      refreshStyleEditor(category, type);
    }
  } else if (split.length === 2) {
    // If the split is length 2, then a type was updated.
    let category = split[0];
    let type = split[1];

    // Refresh the editor if the selected style is in the same category and type.
    if (editStyleSelect.options[editStyleSelect.selectedIndex].dataset.category === category &&
      editStyleSelect.options[editStyleSelect.selectedIndex].dataset.type === type) {
      refreshStyleEditor(category, type);
    }
  }
}
// => INIT(S)
JSONEditor.defaults.options.disable_edit_json = true;
JSONEditor.defaults.options.disable_properties = true;

/* SCENES TAB */

// => DOM ELEMENTS
let loadCustomSceneBtn = document.getElementById("load-custom-scene-btn");
let loadSceneBtn = document.getElementById("load-scene-btn");
let loadSceneDropdown = document.getElementById("load-scene-dropdown");

let sceneFieldset = document.getElementById("scenes-fieldset");
let sceneProtectedFieldset = document.getElementById("scene-protected-fields");
let currentScene = document.getElementById("current-scene");

let openSceneBtn = document.getElementById("open-scene-btn");
let deleteSceneBtn = document.getElementById("delete-scene-btn");
let openOrDeleteSceneDropdown = document.getElementById("open-scene-dropdown");
let saveSceneBtn = document.getElementById("save-scene-btn");
let saveAsSceneBtn = document.getElementById("save-scene-as-btn");

let sceneTitleInput = document.getElementById("scene-name-input");
let sceneTitleSaveAsInput = document.getElementById("scene-name-save-as-input");

let sceneLayoutTypeSelect = document.getElementById("scene-layout-type-select");
let sceneLayoutCategorySchemaElement = document.getElementById("scene-layout-category-schema-editor");
let sceneLayoutTypeSchemaElement = document.getElementById("scene-layout-type-schema-editor");

let scenePlaylistAddBtn = document.getElementById("scene-playlist-add-btn");
let scenePlaylistAddDropdown = document.getElementById("scene-playlist-add-dropdown");
let scenePlaylistClearBtn = document.getElementById("scene-playlist-clear-btn");
let scenePlaylistEditor = document.getElementById("scene-playlist-editor");
let scenePlaylistKeepBtn = document.getElementById("scene-playlist-keep-btn");
let scenePlaylistStatusText = document.getElementById("scene-playlist-status-text");
let scenePlaylistLoopBtn = document.getElementById("scene-playlist-loop-btn");

let sceneSlidePreview = document.getElementById("scene-slide-preview");
let sceneSelectSlideBtn = document.getElementById("scene-select-slide-btn");
let sceneSelectSlideDropdown = document.getElementById("scene-select-slide-dropdown");
let sceneClearSlideBtn = document.getElementById("scene-clear-slide-btn");
let sceneSlideLoopBtn = document.getElementById("scene-slide-loop-btn");

let sceneStreamStateSelect = document.getElementById("stream-state-select");
let sceneRecordStateSelect = document.getElementById("record-state-select");
let sceneZoomAudioSelect = document.getElementById("zoom-audio-select");

// => PRIMITIVE AND OTHER TYPES
let layoutTypeSchemaEditor;
let layoutCategorySchemaEditor;

// => METHODS

async function populateSceneDropdown(dropdownElem, selectCallback, filterProtectedScenes){
  // Get a list of all the scenes.
  let resp = await v2api.get("/scenes");
  let data = await resp.json();
  // Clear the dropdown.
  dropdownElem.innerHTML = "";
  // Iterate through keys.
  Object.keys(data["Scenes"]).forEach((scene) => {
    let isProtected = data["Scenes"][scene]["IsProtected"];
    if (filterProtectedScenes === true && isProtected === true) {
      return;
    }
    let sceneTitle = data["Scenes"][scene]["SceneTitle"];
    // Create a list item for the scene.
    let sceneLi = document.createElement("li");
    let sceneA = document.createElement("a");
    sceneA.classList.add("dropdown-item");
    sceneA.innerHTML = sceneTitle;
    sceneLi.appendChild(sceneA);
    sceneLi.dataset.scene = scene;
    dropdownElem.appendChild(sceneLi);
  });
  
  setupDropdown(dropdownElem, selectCallback);
}

async function onLoadCustomSceneBtnClicked() {
  await populateSceneDropdown(loadSceneDropdown, onLoadSceneSelected, true);
}

async function onLoadSceneBtnClicked() {
  await populateSceneDropdown(loadSceneDropdown, onLoadSceneSelected, false);
}

async function onLoadSceneSelected(elem) {
  //Get the scene.
  let scene = elem.dataset.scene;
  //Perform the api call
  let resp = await v2api.put(`/scene/${scene}/load`);
  let data = await resp.json();

  if (v2api.checkErrorCode(data, 0) === true) {
    Feedback.alertSuccess("Success: Loaded scene " + elem.innerText);
  } else {
    Feedback.alertDanger(`${data["ErrorMessage"]}<br>${data["ErrorResolution"]}`);
  }
}

async function onOpenSceneBtnClicked() {
  // Get a list of all the scenes.
  let resp = await v2api.get("/scenes");
  let data = await resp.json();
  // Clear the dropdown.
  openOrDeleteSceneDropdown.innerHTML = "";
  // Iterate through keys.
  Object.keys(data["Scenes"]).forEach((scene) => {
    let sceneTitle = data["Scenes"][scene]["SceneTitle"];
    // Create a list item for the scene.
    let sceneLi = document.createElement("li");
    let sceneA = document.createElement("a");
    sceneA.classList.add("dropdown-item");
    sceneA.innerHTML = sceneTitle;
    sceneLi.appendChild(sceneA);
    sceneLi.dataset.scene = scene;
    openOrDeleteSceneDropdown.appendChild(sceneLi);
  })

  setupDropdown(openOrDeleteSceneDropdown, openOnSceneSelected);
}

async function onDeleteSceneBtnClicked() {
  // Get a list of all the unprotected scenes.
  let resp = await v2api.get("/scenes");
  let data = await resp.json();
  // Clear the dropdown.
  openOrDeleteSceneDropdown.innerHTML = "";
  // Iterate through keys.
  Object.keys(data["Scenes"]).forEach((scene) => {
    let isProtected = data["Scenes"][scene]["IsProtected"];
    if (isProtected === false) {
      let sceneTitle = data["Scenes"][scene]["SceneTitle"];
      // Create a list item for the scene.
      let sceneLi = document.createElement("li");
      let sceneA = document.createElement("a");
      sceneA.classList.add("dropdown-item");
      sceneA.innerHTML = sceneTitle;
      sceneLi.appendChild(sceneA);
      sceneLi.dataset.scene = scene;
      openOrDeleteSceneDropdown.appendChild(sceneLi);
    }
  });

  setupDropdown(openOrDeleteSceneDropdown, deleteOnSceneSelected);
}

async function onSaveSceneBtnClicked() {
  let sceneId = currentScene.dataset.sceneId;
  let sceneTitle = sceneTitleInput.value;
  
  if (sceneId === undefined || sceneId === "") {
    Feedback.alertDanger("No scene is open");
    return;
  }
  
  try{
    await saveScene(sceneId, sceneTitle);
  } catch (e) {
    console.error(e);
    Feedback.alertDanger("Failed to save scene");
  }
}

async function onSaveAsSceneBtnClicked() {
  let sceneId = Date.now().toString();
  let sceneTitle = sceneTitleSaveAsInput.value;
  try {
    await saveScene(sceneId, sceneTitle);
  } catch (e) {
    console.error(e);
    Feedback.alertDanger("Failed to save scene");
  }
}

async function openOnSceneSelected(elem) {
  sceneFieldset.classList.remove("d-none");
  let scene = elem.dataset.scene;
  await openScene(scene);
}

async function saveScene(sceneId, sceneTitle){
  let displayLayoutType = sceneLayoutTypeSelect.value;

  let layoutCategoryData = null;
  let layoutTypeData = null;
  if (displayLayoutType !== "Keep") {
    if (layoutCategorySchemaEditor && layoutTypeSchemaEditor){
      layoutCategoryData = layoutCategorySchemaEditor.getValue();
      layoutTypeData = layoutTypeSchemaEditor.getValue();
    }
  }

  let slide = sceneSlidePreview.dataset.url;
  let playlist = [];
  let music = 0;
  let stream = sceneStreamStateSelect.value;
  let record = sceneRecordStateSelect.value;
  let zoomAudio = sceneZoomAudioSelect.value;

  for (let i = 0; i < scenePlaylistEditor.children.length; i++) {
    playlist.push(scenePlaylistEditor.children[i].dataset.value);
  }

  if (playlist.length === 0) {
    music = parseInt(scenePlaylistStatusText.dataset.value);
  }

  let resp = await v2api.put(`/scene/${sceneId}`, {
    "SceneId": sceneId,
    "SceneTitle": sceneTitle,
    "DisplayLayoutType": displayLayoutType,
    "LayoutCategoryData": layoutCategoryData,
    "LayoutTypeData": layoutTypeData,
    "Slide": slide,
    "LoopVideo": sceneSlideLoopBtn.classList.contains("active") ? 0 : 1,
    "Music": music,
    "Playlist": playlist,
    "LoopPlaylist": scenePlaylistLoopBtn.classList.contains("active") ? 0 : 1,
    "Stream": parseInt(stream),
    "Record": parseInt(record),
    "ZoomAudio": parseInt(zoomAudio),
    "HotbarEnabled": false,
    "SecondClick": null,
  });

  let data = await resp.json();
  if (v2api.checkErrorCode(data, 0) === true) {
    Feedback.alertSuccess("Success: Saved scene " + sceneTitle);
    await openScene(sceneId);
  } else {
    Feedback.alertDanger(`${data["ErrorMessage"]}<br>${data["ErrorResolution"]}`);
  }
}

async function openScene(scene){
  let resp = await v2api.get(`/scene/${scene}`);
  let data = await resp.json();

  // Get data from the response.
  let isProtected = data["IsProtected"];
  let sceneData = data["Scene"];
  let sceneTitle = sceneData["SceneTitle"];
  let displayLayoutType = sceneData["DisplayLayoutType"];
  let stream = sceneData["Stream"];
  let record = sceneData["Record"];
  let slide = sceneData["Slide"];
  let loopVideo = sceneData["LoopVideo"] === 0;
  let music = sceneData["Music"];
  let playlist = sceneData["Playlist"];
  let loopPlaylist = sceneData["LoopPlaylist"] === 0;
  let layoutCategoryData = sceneData["LayoutCategoryData"];
  let layoutTypeData = sceneData["LayoutTypeData"];
  let zoomAudio = sceneData["ZoomAudio"];

  currentScene.innerHTML = `Open Scene: ${sceneTitle}`;
  currentScene.dataset.sceneId = scene;

  // Set the scene title.
  sceneTitleInput.value = sceneTitle;

  // Set the layout type.
  sceneLayoutTypeSelect.value = displayLayoutType;
  await updateSceneLayoutType(displayLayoutType);
  setTimeout(() => {
    // Set the layout category data.
    if (layoutCategoryData && layoutCategorySchemaEditor) {
      layoutCategorySchemaEditor.setValue(layoutCategoryData);
    }

    // Set the layout type data.
    if (layoutTypeData && layoutTypeSchemaEditor) {
      layoutTypeSchemaEditor.setValue(layoutTypeData);
    }
  }, 1000);

  // Set the slide.
  setSceneSlidePreview(slide);

  // Set the music.
  if (music === 1) {
    onClearScenePlaylistBtnClicked();
  } else if (music === 2) {
    onKeepScenePlaylistBtnClicked();
  } else {
    scenePlaylistEditor.innerHTML = "";
    scenePlaylistStatusText.dataset.value = 0;
    // Update the playlist editor.
    for (let i = 0; i < playlist.length; i++) {
      addTrackToPlaylist(playlist[i]);
    }
  }

  // Set the zoom audio.
  sceneZoomAudioSelect.value = zoomAudio;

  // Set the stream state.
  sceneStreamStateSelect.value = stream;

  // Set the record state.
  sceneRecordStateSelect.value = record;
  
  // Set the loop video.
  setSceneSlideLoopBtnActive(loopVideo);

  // Set the loop playlist.
  setScenePlaylistLoopBtnActive(loopPlaylist);

  sceneProtectedFieldset.disabled = isProtected !== false;
}

async function deleteOnSceneSelected(elem) {
  let scene = elem.dataset.scene;
  let resp = await v2api.del(`/scene/${scene}`);
  if (resp.ok) {
    let data = await resp.json();
    if (v2api.checkErrorCode(data, 0) === true) {
      Feedback.alertSuccess("Success: Deleted scene " + elem.innerText);
    }
  }
}

function onClearSlideBtnClicked() {
  setSceneSlidePreview("Clear");
}

function onClearScenePlaylistBtnClicked() {
  scenePlaylistStatusText.dataset.value = 1;
  scenePlaylistStatusText.innerHTML = "The music player will stop playing.";
  scenePlaylistEditor.innerHTML = "";
}

function onScenePlaylistLoopBtnClicked() {
  let active = scenePlaylistLoopBtn.classList.contains("active");
  setScenePlaylistLoopBtnActive(!active);
}

function setScenePlaylistLoopBtnActive(active) {
  scenePlaylistLoopBtn.classList.toggle("active", active);
  scenePlaylistLoopBtn.innerHTML = active ? `Loop Playlist` : `<s>Loop Playlist</s>`;
}

function onKeepScenePlaylistBtnClicked() {
  scenePlaylistStatusText.dataset.value = 2;
  scenePlaylistStatusText.innerHTML = "The music player will keep playing.";
  scenePlaylistEditor.innerHTML = "";
}

async function onScenePlaylistAddBtnClicked() {
  let resp = await fetch("/all_holding_music");
  let data = await resp.json();
  scenePlaylistAddDropdown.innerHTML = "";
  for (let i = 0; i < data.length; i++) {
    let music = data[i];
    let musicLi = document.createElement("li");
    let musicA = document.createElement("a");
    musicA.classList.add("dropdown-item");
    musicA.innerHTML = music;
    musicLi.appendChild(musicA);
    scenePlaylistAddDropdown.appendChild(musicLi);
  }

  setupDropdown(scenePlaylistAddDropdown, onScenePlaylistMusicSelected);
}

function onScenePlaylistMusicSelected(elem) {
  addTrackToPlaylist(elem.innerText);
}

function addTrackToPlaylist(track) {
  scenePlaylistStatusText.dataset.value = 0;
  scenePlaylistStatusText.innerHTML = "The music player will update its playlist.";
  //Create a list item for the music.
  let musicLi = document.createElement("li");
  let musicSpan = document.createElement("span");
  musicLi.dataset.value = track;
  musicLi.innerText = track;
  musicLi.classList.add("list-group-item", "d-flex", "justify-content-between", "align-items-center");
  musicLi.appendChild(musicSpan);
  musicSpan.classList.add("badge", "bg-danger", "badge-pill");
  musicSpan.innerText = "Remove";
  musicSpan.style.cursor = "pointer";
  musicSpan.onclick = function () {
    musicLi.remove();
    // Check if all children have been removed.
      if (scenePlaylistEditor.children.length === 0) {
        onClearScenePlaylistBtnClicked();
      }
  }
  musicLi.appendChild(musicSpan);

  scenePlaylistEditor.appendChild(musicLi);
}

async function onSceneSelectSlideBtnClicked() {
  let resp = await unityFetch("/getHoldingSlides");
  let data = await resp.json();
  sceneSelectSlideDropdown.innerHTML = "";
  // Add the default option.
  let defaultOptionLi = document.createElement("li");
  let defaultOptionA = document.createElement("a");
  defaultOptionA.classList.add("dropdown-item");
  defaultOptionA.innerHTML = "Keep";
  defaultOptionLi.appendChild(defaultOptionA);
  defaultOptionLi.dataset.url = "Keep";
  sceneSelectSlideDropdown.appendChild(defaultOptionLi);
  for (let i = 0; i < data.length; i++) {
    let slide = data[i];
    let holdingSlideLi = document.createElement("li");
    let holdingSlideA = document.createElement("a");
    holdingSlideA.classList.add("dropdown-item");
    holdingSlideA.innerHTML = slide.name;
    holdingSlideLi.appendChild(holdingSlideA);
    holdingSlideLi.dataset.url = slide.url;
    sceneSelectSlideDropdown.appendChild(holdingSlideLi);
  }

  setupDropdown(sceneSelectSlideDropdown, onSceneSlideSelected);
}

async function onSceneSlideLoopBtnClicked() {
  let active = sceneSlideLoopBtn.classList.contains("active");
  setSceneSlideLoopBtnActive(!active);
}

async function onSceneSlideSelected(elem) {
  setSceneSlidePreview(elem.dataset.url);
}

function setSceneSlidePreview(url) {
  sceneSlidePreview.dataset.url = url;
  if (url === "Keep") {
    sceneSlidePreview.src = "";
    sceneSlidePreview.alt = "Holding slide will be kept.";
  } else if (url === "Clear") {
    sceneSlidePreview.src = "";
    sceneSlidePreview.alt = "Holding slide will be cleared.";
  } else {
    sceneSlidePreview.src = url;
    sceneSlidePreview.alt = `Holding slide will be updated to ${url}.`;
  }
}

function setSceneSlideLoopBtnActive(active) {
  sceneSlideLoopBtn.classList.toggle("active", active);
  sceneSlideLoopBtn.innerHTML = active ? `Loop Video Player` : `<s>Loop Video Player</s>`;
}

async function onSceneTabClicked() {
  if (styleData === undefined) {
    fetchStyleData();
  }
}

function populateSceneLayoutTypeSelectAndGenerateLayoutCategoryEditor() {
  // Access the layout category.
  let layoutCategory = styleData["Categories"]["layouts"];
  // Clear the dropdown.
  sceneLayoutTypeSelect.innerHTML = "";
  // Create an option for the default.
  let defaultOption = document.createElement("option");
  defaultOption.value = "Keep";
  defaultOption.innerHTML = "Keep";
  sceneLayoutTypeSelect.appendChild(defaultOption);
  // Iterate through the layout types.
  Object.keys(layoutCategory["Types"]).forEach((layoutType) => {
    // Create an option for the layout type.
    let layoutTypeOption = document.createElement("option");
    layoutTypeOption.value = layoutType;
    layoutTypeOption.innerHTML = layoutCategory["Types"][layoutType]["Alias"];
    sceneLayoutTypeSelect.appendChild(layoutTypeOption);
  });
  // Generate the layout category editor.
  generateSceneCategorySchemaEditor(layoutCategory["Schema"], layoutCategory["Data"]);
  onSceneLayoutTypeSelectChanged();
}

async function onSceneLayoutTypeSelectChanged() {
  await updateSceneLayoutType(sceneLayoutTypeSelect.value);
}

async function updateSceneLayoutType(type){
  if (type === "Keep") {
    // Hide the layout type schema editor.
    sceneLayoutTypeSchemaElement.classList.add("d-none");
    sceneLayoutCategorySchemaElement.classList.add("d-none");
    return;
  } else {
    // Hide the layout type schema editor.
    sceneLayoutTypeSchemaElement.classList.remove("d-none");
    sceneLayoutCategorySchemaElement.classList.remove("d-none");
  }

  if (styleData === undefined){
    await fetchStyleData();
  }
  let layoutType = styleData["Categories"]["layouts"]["Types"][type];
  if (layoutType === undefined) {
    // If the layout type is undefined, then update the layout type to "Keep".
    await updateSceneLayoutType("Keep");
    return;
  }
  // Fetch current layout type data.
  let resp = await v2api.get(`/style/layouts/${type}`);
  let layoutTypeData = await resp.json();
  generateSceneTypeSchemaEditor(layoutType["Schema"], layoutTypeData["Data"]);
}

function generateSceneCategorySchemaEditor(schema, startval) {
  if (layoutCategorySchemaEditor) {
    layoutCategorySchemaEditor.destroy();
  }

  layoutCategorySchemaEditor = new JSONEditor(sceneLayoutCategorySchemaElement, {
    schema: schema,
    theme: 'bootstrap4',
    startval: startval,
  });

  layoutCategorySchemaEditor.on('ready', () => {
    // Now the api methods will be available
    validateSceneCategorySchema();
  });

  function validateSceneCategorySchema() {
    const err = layoutCategorySchemaEditor.validate();

    if (err.length) {
      console.log(err); //if the schema is invalid
      return false;
    }
    return true;
  }
}

function generateSceneTypeSchemaEditor(schema, startval) {
  if (layoutTypeSchemaEditor) {
    layoutTypeSchemaEditor.destroy();
  }

  layoutTypeSchemaEditor = new JSONEditor(sceneLayoutTypeSchemaElement, {
    schema: schema,
    theme: 'bootstrap4',
    startval: startval,
  });

  layoutTypeSchemaEditor.on('ready', () => {
    // Now the api methods will be available
    validateSceneTypeSchema();
  });

  function validateSceneTypeSchema() {
    const err = layoutTypeSchemaEditor.validate();

    if (err.length) {
      console.log(err); //if the schema is invalid
      return false;
    }
    return true;
  }
}


// => EVENT LISTENERS
loadCustomSceneBtn.addEventListener("click", onLoadCustomSceneBtnClicked);
loadSceneBtn.addEventListener("click", onLoadSceneBtnClicked);
openSceneBtn.addEventListener("click", onOpenSceneBtnClicked);
deleteSceneBtn.addEventListener("click", onDeleteSceneBtnClicked);
saveSceneBtn.addEventListener("click", onSaveSceneBtnClicked);
saveAsSceneBtn.addEventListener("click", onSaveAsSceneBtnClicked);
scenePlaylistKeepBtn.addEventListener("click", onKeepScenePlaylistBtnClicked);
scenePlaylistAddBtn.addEventListener("click", onScenePlaylistAddBtnClicked);
scenePlaylistClearBtn.addEventListener("click", onClearScenePlaylistBtnClicked);
scenePlaylistLoopBtn.addEventListener("click", onScenePlaylistLoopBtnClicked);
sceneClearSlideBtn.addEventListener("click", onClearSlideBtnClicked);
sceneSelectSlideBtn.addEventListener("click", onSceneSelectSlideBtnClicked);
sceneSlideLoopBtn.addEventListener("click", onSceneSlideLoopBtnClicked);
sceneLayoutTypeSelect.addEventListener("change", onSceneLayoutTypeSelectChanged);

// => INIT(S)

/* SLIDE TAB */
// => DOM ELEMENTS
let conc_preview = document.getElementById("conc-preview");
let intro_preview = document.getElementById("intro-preview");
let late_preview = document.getElementById("late-preview");
let slideBtnContainer = document.getElementById("slide-btn-container");
let slideFieldset = document.getElementById("slide-fieldset");
let techdiff_preview = document.getElementById("techdiff-preview");

let slideClearBtn = document.getElementById("slide-clear-btn");
let slideSwitchBtn = document.getElementById("slide-btn-element");

// => PRIMITVE AND OTHER TYPES
let slideSwitchBtns = [];

// => METHODS
function FetchAssignedHoldingSlidesAndUpdatePreviews() {
  unityFetch("/getAssignedHoldingSlides")
    .then(resp => resp.json())
    .then(json => {
      // todo set to placeholder image instead of clearing.
      intro_preview.style.backgroundImage = "";
      late_preview.style.backgroundImage = "";
      techdiff_preview.style.backgroundImage = "";
      conc_preview.style.backgroundImage = "";
      previewIntroImg.src = "...";
      previewIntroImgCaption.innerHTML = "No slide assigned. Placeholder slide will be used.";
      previewIntroImg.classList.add("d-none");

      for (let i = 0; i < json.length; i++) {
        let slideInfo = json[i];
        if (slideInfo.isVideo) {
          getVideoThumb(slideInfo.url, 1)
            .then(blob => {
              setBackgroundImageHelper(URL.createObjectURL(blob));
            });
        } else {
          setBackgroundImageHelper(slideInfo.url);
        }

        function setBackgroundImageHelper(url) {
          if (slideInfo.assignedTo.includes("intro")) {
            intro_preview.style.backgroundImage = `url("${url}")`;
            previewIntroImg.src = url;
            previewIntroImg.classList.remove("d-none");
            previewIntroImgCaption.innerHTML = "This will be used as your Intro Slide.";
          }
          if (slideInfo.assignedTo.includes("late")) {
            late_preview.style.backgroundImage = `url("${url}")`;
          }
          if (slideInfo.assignedTo.includes("technicalDifficulties")) {
            techdiff_preview.style.backgroundImage = `url("${url}")`;
          }
          if (slideInfo.assignedTo.includes("outro")) {
            conc_preview.style.backgroundImage = `url("${url}")`;
          }
        }
      }
    });
}

function onSlideTabClicked() {
  unityFetch("/getHoldingSlides")
    .then(resp => resp.json())
    .then(json => {
      validateSlideSwitchBtns(json);
    });
  FetchAssignedHoldingSlidesAndUpdatePreviews();
}

// slide delete pill button.
function setupDeleteButton(owner, route, elementWithFilename, onDeleteConfirmed) {
  let deleteBtn = document.querySelector(`#${owner.id} .media-delete-btn`);
  let ogDeleteContents = deleteBtn.innerHTML;
  let confirmDeleteContents = `Confirm delete?`;
  deleteBtn.addEventListener("click", function (ev) {
    ev.stopPropagation();
    if (deleteBtn.innerHTML !== confirmDeleteContents) {
      // Confirm deletion.
      deleteBtn.innerHTML = confirmDeleteContents;
      setTimeout(function () {
        deleteBtn.innerHTML = ogDeleteContents;
      }, 2000);
    } else {
      // Make owner semi-transparent.
      owner.style.opacity = 0.5;
      deleteBtn.innerHTML = "Deleting...";
      // Delete media.
      fetch(route.replace("{0}", elementWithFilename.thingToDelete), { method: "DELETE" })
        .then(function (response) {
          if (response.ok) {
            onDeleteConfirmed();
          }
        })
        .finally(function () {
          owner.style.opacity = 1; // Reset owner opacity.
          deleteBtn.innerHTML = ogDeleteContents; //Reset delete button.
        });
      FetchAssignedHoldingSlidesAndUpdatePreviews();
    }
  });
}

// Slide switch button. Used in both the slide tab and the video tab.
function setupSlideSwitchButton(switchBtn, onDeleteConfirmed) {
  switchBtn.style.display = "flex";
  let span = document.querySelector(`#${switchBtn.id} span`);
  let img = document.querySelector(`#${switchBtn.id} img`);
  let mute = document.querySelector(`#${switchBtn.id} .media-right-btn`);
  let muteDropdown = document.querySelector(`#${switchBtn.id} .media-right-dropdown`);
  let unmute = document.querySelector(`#${switchBtn.id} .media-left-btn`);
  let unmuteDropdown = document.querySelector(`#${switchBtn.id} .media-left-dropdown`);

  setupSlideSetAsOptionsButton(switchBtn);
  setupDeleteButton(switchBtn, "/uapp/deleteHoldingSlide?url={0}", span, onDeleteConfirmed);

  setupDropdown(muteDropdown, async function (elem) {
    await handleDropdown(elem, 0)
  })
  setupDropdown(unmuteDropdown, async function (elem) {
    await handleDropdown(elem, 1)
  })

  mute.addEventListener("click", () => {
    let intro = muteDropdown.querySelector("li[data-scene='intro'] a")
    intro.innerHTML = appStatus.lastSceneLoaded === "Intro" ? "Stay Intro" : "Go Intro";
    let live = muteDropdown.querySelector("li[data-scene='live'] a")
    live.innerHTML = appStatus.lastSceneLoaded === "Live" ? "Stay Live" : "Go Live";
    let outro = muteDropdown.querySelector("li[data-scene='outro'] a")
    outro.innerHTML = appStatus.lastSceneLoaded === "Conclusion" ? "Stay Conclusion" : "Go Conclusion"
  });
  unmute.addEventListener("click", () => {
    let intro = unmuteDropdown.querySelector("li[data-scene='intro'] a")
    intro.innerHTML = appStatus.lastSceneLoaded === "Intro" ? "Stay Intro" : "Go Intro";
    let live = unmuteDropdown.querySelector("li[data-scene='live'] a")
    live.innerHTML = appStatus.lastSceneLoaded === "Live" ? "Stay Live" : "Go Live";
    let outro = unmuteDropdown.querySelector("li[data-scene='outro'] a")
    outro.innerHTML = appStatus.lastSceneLoaded === "Conclusion" ? "Stay Conclusion" : "Go Conclusion"
  });

  async function handleDropdown(elem, zoomAudio){
    let scene = elem.dataset.scene;
    let resp = await v2api.put(`/scene/${scene}/load`, {
      "SlideOverride" : img.alt,
      "ZoomAudioOverride" : zoomAudio
    })
    let data = await resp.json();
    if (v2api.checkErrorCode(data, 0)) {
      let sceneToTitle = {
        "intro" : "Intro",
        "outro" : "Conclusion",
        "live" : "Live"
      }
      Feedback.alertSuccess(`Video set. ${sceneToTitle[scene]} scene loaded.`);
    }
    else
    {
      Feedback.alertDanger(`Scene not loaded. ${data.ErrorMessage}`);
    }
  }
}

function setupSlideSetAsOptionsButton(owner) {
  let slideSetAsIntro = document.querySelector(`div#${owner.id} a[target="action-set-as-intro"]`);
  let slideSetAsLate = document.querySelector(`div#${owner.id} a[target="action-set-as-late"]`);
  let slideSetAsTechDiff = document.querySelector(`div#${owner.id} a[target="action-set-as-techdiff"]`);
  let slideSetAsConclusion = document.querySelector(`div#${owner.id} a[target="action-set-as-conclusion"]`);
  let img = document.querySelector(`div#${owner.id} img`);

  slideSetAsIntro.addEventListener("click", (e) => {
    unityFetch(`/assignIntroSlide?url=${img.alt}`, { method: "PUT" })
      .then(resp => {
        if (resp.ok) {
          FetchAssignedHoldingSlidesAndUpdatePreviews();
        }
      });
  });

  slideSetAsLate.addEventListener("click", (e) => {
    unityFetch(`/assignLateSlide?url=${img.alt}`, { method: "PUT" })
      .then(resp => {
        if (resp.ok) {
          FetchAssignedHoldingSlidesAndUpdatePreviews();
        }
      });
  });

  slideSetAsTechDiff.addEventListener("click", (e) => {
    unityFetch(`/assignTechnicalDifficultySlide?url=${img.alt}`, { method: "PUT" })
      .then(resp => {
        if (resp.ok) {
          FetchAssignedHoldingSlidesAndUpdatePreviews();
        }
      });
  });

  slideSetAsConclusion.addEventListener("click", (e) => {
    unityFetch(`/assignConclusionSlide?url=${img.alt}`, { method: "PUT" })
      .then(resp => {
        if (resp.ok) {
          FetchAssignedHoldingSlidesAndUpdatePreviews();
        }
      });
  });

}

function validateSlideSwitchBtns(slides) {
  let setupSlide = function (switchBtn) {
    setupSlideSwitchButton(switchBtn, onSlideTabClicked);
  }
  let validateSlide = function (slide, slideInfo) {
    let img = document.querySelector(`#${slide.id} img`);
    let label = document.querySelector(`#${slide.id} span`);
    label.thingToDelete = slideInfo.url;
    label.innerHTML = slideInfo.name;
    img.src = img.alt = slideInfo.url;
    slide.title = "Switch to " + slideInfo.name;
  }
  ValidateClonesWithJsonArray(slideSwitchBtn, slideBtnContainer, slideSwitchBtns, setupSlide, slides, validateSlide);
}

// => EVENT LISTENERS
conc_preview.addEventListener("click", onArchiveClick);
late_preview.addEventListener("click", onLateClick);
slideClearBtn.addEventListener("click", onLiveClick);
techdiff_preview.addEventListener("click", onTechnicalDiff);

// => INIT(S)
slideSwitchBtn.style.display = "none";

FetchAssignedHoldingSlidesAndUpdatePreviews(); // Update previews on load.

/* HELPER METHODS - MUSIC & VIDEO*/
function convertSecondsToTimestamp(sec) {
  let hh = Math.floor(sec / 3600);
  let mm = Math.floor(sec / 60);
  let ss = sec % 60;
  return `${hh < 10 ? "0" + hh : hh}:${mm < 10 ? "0" + mm : mm}:${ss < 10 ? "0" + ss : ss}`;
}

function getVolumeLevel(value) {
  // Get db value from volume level.
  let db = 20 * Math.log10(value);
  return db.toFixed() + " dB";
}

/* AUDIO TAB */
// => DOM ELEMENTS
let audioFieldset = document.getElementById("audio-fieldset");
let volumeRangeZoom = document.getElementById("volume-range-zoom");
let volumeRangeMaster = document.getElementById("volume-range-master");
let zoomVolumeLevel = document.getElementById("zoom-volume-level");
let masterVolumeLevel = document.getElementById("master-volume-level");
let toggleZoomAudioMuteBtn = document.getElementById("toggle-zoom-audio-mute-btn");
let toggleMasterAudioMuteBtn = document.getElementById("toggle-master-audio-mute-btn");

// => METHODS
function onToggleZoomAudioMuteClicked() {
  if (appStatus.zoomAudioMuted) {
    unityFetch(`/unmuteZoomAudio`, { method: "PUT" });
  } else {
    unityFetch(`/muteZoomAudio`, { method: "PUT" });
  }
}

function onToggleMasterAudioMuteClicked() {
  if (appStatus.masterAudioMuted) {
    unityFetch(`/muteMasterAudio?mute=false`, { method: "PUT" });
  } else {
    unityFetch(`/muteMasterAudio?mute=true`, { method: "PUT" });
  }
}

function onVolumeRangeZoomChanged(){
  let str = volumeRangeZoom.value;
  sendStringSubmitEvent(myVideoPlayer, OperatorControls._SetZoomAudioVolume, str);
}

function onVolumeRangeMasterChanged(){
  let str = volumeRangeMaster.value;
  sendStringSubmitEvent(myVideoPlayer, OperatorControls._SetMasterAudioVolume, str);
}

// => EVENT LISTENERS
toggleZoomAudioMuteBtn.addEventListener("click", onToggleZoomAudioMuteClicked);
volumeRangeZoom.addEventListener("input", onVolumeRangeZoomChanged);
toggleMasterAudioMuteBtn.addEventListener("click", onToggleMasterAudioMuteClicked);
volumeRangeMaster.addEventListener("input", onVolumeRangeMasterChanged);


/* MUSIC TAB */
// => DOM ELEMENTS
let currentlyPlayingSpan = document.getElementById("currently-playing-track");
let currentlyPlayingTrackTime = document.getElementById("currently-playing-track-time");
let holdMusicFieldset = document.getElementById("music-fieldset");
let holdMusicAudioPlayer = document.getElementById("hold-music-audio");
let holdMusicSelect = document.getElementById("hold-music-select");
let holdMusicOptionGroup = document.getElementById("hold-music-options-group");
let library = document.getElementById("library");
let musicProgress = document.getElementById("music-progress");
let musicPlaybackTime = document.getElementById("music-playback-time");
let playlist = document.getElementById("playlist");
let trackInLibrary = document.getElementById("track-in-library");
let trackInPlaylist = document.getElementById("track-in-playlist");
let volumeLevelMusic = document.getElementById("music-volume-level");
let volumeRangeMusic = document.getElementById("volume-range-music");

let musicPlayStopBtn = document.getElementById("music-play-stop-btn");
let musicLoopBtn = document.getElementById("music-loop-btn");

// => PRIMITIVE AND OTHER TYPES
let disableMusicProgressUpdates = false;
let tracksInLibrary = [];
let tracksInPlaylist = [];

// => METHODS
function onMusicPlaybackTimeReceived(time) {
  time = Math.round(time);
  if (!disableMusicProgressUpdates) {
    currentlyPlayingTrackTime.innerHTML = musicPlaybackTime.innerHTML = convertSecondsToTimestamp(time);
    musicProgress.value = time > musicProgress.max ? musicProgress.max : time;
  }
}

function onMusicTabClicked() {
  fetch("/all_holding_music")
    .then(value => value.json())
    .then(music => {
      UpdateOptionGroupWithValues(holdMusicOptionGroup, music);
      UpdateHoldMusicBrowsePreviewElement();
      validateTracksInLibrary(music);
    });
}

function UpdateHoldMusicBrowsePreviewElement() {
  UpdateBrowsePreviewElement("/last_holding_music_update", holdMusicAudioPlayer, holdMusicSelect, "/music");
}

function validateTracksInLibrary(tracks) {
  let setupBtn = function (clone) {
    clone.classList.remove("d-none");
    let span = document.querySelector(`#${clone.id} span`);
    setupDeleteButton(clone, "/music_delete/{0}", span, FetchAllUploadedMediaAndUpdateDash);
    let addTrackBtn = document.querySelector(`#${clone.id} .add-track-btn`);
    addTrackBtn.addEventListener("click", function () {
      // Add to playlist
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._AddHoldingMusicToPlaylist, span.innerHTML);
    });
  }
  let validateBtn = function (btn, music) {
    let label = document.querySelector(`#${btn.id} span`);
    label.thingToDelete = label.innerHTML = label.title = music;
  }
  ValidateClonesWithJsonArray(trackInLibrary, library, tracksInLibrary, setupBtn, tracks, validateBtn);
}

function validateTracksInPlaylist(playlistData, currentlyPlayingIndex) {
  let setupBtn = function (clone) {
    clone.classList.remove("d-none");
    let span = document.querySelector(`#${clone.id} span`);
    let removeTrackBtn = document.querySelector(`#${clone.id} .remove-track-btn`);
    removeTrackBtn.addEventListener("click", function () {
      let idx = tracksInPlaylist.indexOf(clone);
      // Remove from playlist
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._RemoveHoldingMusicFromPlaylist, idx.toString());
    })
  }
  let currentlyPlayingTrack = tracksInPlaylist[currentlyPlayingIndex];
  let validateBtn = function (btn, music) {
    // Reset class lists.
    let labelDiv = document.querySelector(`#${btn.id} div`);
    let removeTrackBtn = document.querySelector(`#${btn.id} .remove-track-btn`);
    labelDiv.classList.remove("text-danger");
    labelDiv.classList.remove("text-white");
    labelDiv.classList.remove("text-dark");
    labelDiv.classList.remove("bg-danger");
    labelDiv.classList.remove("bg-info");
    labelDiv.classList.remove("bg-secondary");
    removeTrackBtn.classList.remove("btn-secondary");
    removeTrackBtn.classList.remove("btn-info");
    let label = document.querySelector(`#${btn.id} span`);
    label.innerHTML = label.title = music.trackLabel;
    if (music.loaded === false) {
      labelDiv.classList.add("text-danger");
      labelDiv.classList.add("bg-secondary");
      removeTrackBtn.classList.add("btn-secondary");
      label.innerHTML += music.loadStatus;
    } else if (currentlyPlayingTrack === btn) {
      labelDiv.classList.add("text-dark");
      labelDiv.classList.add("bg-info");
      removeTrackBtn.classList.add("btn-info");
    } else {
      labelDiv.classList.add("text-white");
      labelDiv.classList.add("bg-secondary");
      removeTrackBtn.classList.add("btn-secondary");
    }
  }
  ValidateClonesWithJsonArray(trackInPlaylist, playlist, tracksInPlaylist, setupBtn, playlistData, validateBtn);
}

// => EVENT LISTENERS
holdMusicSelect.addEventListener("change", UpdateHoldMusicBrowsePreviewElement);

musicProgress.addEventListener("input", function () {
  disableMusicProgressUpdates = true;
  currentlyPlayingTrackTime.innerHTML = musicPlaybackTime.innerHTML = convertSecondsToTimestamp(musicProgress.value);
});

musicProgress.addEventListener("change", async function () {
  setTimeout(function () {
    disableMusicProgressUpdates = false;
  }, 1000);
  await v2api.put('/musicPlayer', {
    SeekPosition: parseFloat(musicProgress.value)
  });
});

musicPlayStopBtn.addEventListener("click", async function () {
  await v2api.put('/musicPlayer', {
    Play: !appStatus.playingHoldingMusic
  });
});

musicLoopBtn.addEventListener("click", async function () {
  await v2api.put('/musicPlayer', {
    Loop: !appStatus.loopingHoldingMusic
  });
});

volumeRangeMusic.addEventListener("input", function () {
  let str = volumeRangeMusic.value;
  volumeLevelMusic.innerHTML = getVolumeLevel(volumeRangeMusic.value);
  sendStringSubmitEvent(myVideoPlayer, OperatorControls._SetHoldingMusicVolume, str);
});

// => INIT(S)
trackInLibrary.classList.add("d-none");
trackInPlaylist.classList.add("d-none");
volumeLevelMusic.innerHTML = getVolumeLevel(volumeRangeMusic.value);

/* VIDEO TAB */
// => DOM ELEMENTS
let videoBtnContainer = document.getElementById("video-btn-container");
let videoFieldsetBar = document.getElementById("video-fieldset-bar");
let volumeLevelVideo = document.getElementById("video-volume-level");
let videoOptionGroup = document.getElementById("video-option-group");
let videoPlayer = document.getElementById("video");
let videoPlaybackTime = document.getElementById("video-playback-time");
let videoProgress = document.getElementById("video-progress");
let videoSelect = document.getElementById("video-select");
let volumeRangeVideo = document.getElementById("volume-range-video");

let videoClearBtn = document.getElementById("video-clear-btn");
let videoPlayPauseBtn = document.getElementById("video-play-stop-btn");
let videoLoopBtn = document.getElementById("video-loop-btn");
let videoSwitchBtn = document.getElementById("video-btn-element");

// => PRIMITIVE AND OTHER TYPES
let disableVideoProgressUpdates = false;
let videoSwitchBtns = [];

// => METHODS

function onVideoPlaybackTimeReceived(time) {
  time = Math.round(time);
  if (!disableVideoProgressUpdates) {
    videoPlaybackTime.innerHTML = convertSecondsToTimestamp(time);
    videoProgress.value = time > videoProgress.max ? videoProgress.max : time;
  }
}

function onVideoTabClicked() {
  // Fetch videos.
  unityFetch("/getVideos")
    .then(value => value.json())
    .then(videos => {
      let videoNames = videos.map(video => video.name);
      UpdateOptionGroupWithValues(videoOptionGroup, videoNames);
      UpdateVideoBrowsePreviewElement();
      validateVideoSwitchBtns(videos);
    });
}

function UpdateVideoBrowsePreviewElement() {
  UpdateBrowsePreviewElement("/last_slide_update", videoPlayer, videoSelect, "/slides");
}

function validateVideoSwitchBtns(videos) {
  let setupVideoSwitchBtn = function (switchBtn) {
    setupSlideSwitchButton(switchBtn, onVideoTabClicked);
  }
  let validateVideoSwitchBtn = function (video, slideInfo) {
    let img = document.querySelector(`#${video.id} img`);
    let label = document.querySelector(`#${video.id} span`);
    label.thingToDelete = img.alt = slideInfo.url;
    label.innerHTML = slideInfo.name;
    getVideoThumb(slideInfo.url, 1)
      .then(function (blob) {
        img.src = URL.createObjectURL(blob);
      })
      .catch(function (err) {
        img.src = slideInfo.url;
      });
    video.title = "Switch to " + slideInfo.name;
  }
  ValidateClonesWithJsonArray(videoSwitchBtn, videoBtnContainer, videoSwitchBtns, setupVideoSwitchBtn, videos, validateVideoSwitchBtn);
}

// => EVENT LISTENERS
videoClearBtn.addEventListener("click", onLiveClick);

videoProgress.addEventListener("input", function () {
  disableVideoProgressUpdates = true;
  videoPlaybackTime.innerHTML = convertSecondsToTimestamp(videoProgress.value);
});

videoProgress.addEventListener("change", async function () {
  setTimeout(function () {
    disableVideoProgressUpdates = false;
  }, 1000);
  await v2api.put('/videoPlayer', {
    SeekPosition: parseFloat(videoProgress.value)
  })
});

videoPlayPauseBtn.addEventListener("click", async function () {
  await v2api.put('/videoPlayer', {
    Play: !appStatus.playingVideo
  })
});

volumeRangeVideo.addEventListener("input", function () {
  let str = volumeRangeVideo.value;
  volumeLevelVideo.innerHTML = getVolumeLevel(volumeRangeVideo.value);
  sendStringSubmitEvent(myVideoPlayer, OperatorControls._VolumeVideo, str);
});

videoLoopBtn.addEventListener("click", async function () {
  await v2api.put('/videoPlayer', {
    Loop: !appStatus.loopingVideo
  })
});

// => INIT(S)
volumeLevelVideo.innerHTML = getVolumeLevel(volumeRangeVideo.value);
videoSwitchBtn.style.display = "none";


/* SLACK TAB */
// => DOM ELEMENTS

let slackFieldset = document.getElementById("slack-fieldset");
let slackChannelInput = document.getElementById("slack-channel-input");
let slackChannelDatalist = document.getElementById("slack-channel-datalist");
let slackSetChannelBtn = document.getElementById("slack-set-channel-btn");
let slackTestPostMessageBtn = document.getElementById("slack-test-post-message-btn");

// => PRIMITIVE AND OTHER TYPES
let fetchingChannels = false;

// => METHODS
async function onSlackChannelInputChanged() {
  if (slackChannelInput.value.length > 0) {
    slackSetChannelBtn.disabled = false;
  } else {
    slackSetChannelBtn.disabled = true;
  }

  // Check if the datalist has been populated.
  if (slackChannelDatalist.children.length === 0 && fetchingChannels === false) {
    fetchingChannels = true;
    // Fetch channels.
    let resp = await v2api.get("/slack/channels");
    let data = await resp.json();
    if (v2api.checkErrorCode(data, 0) === true) {
      slackChannelDatalist.innerHTML = "";
      let channels = data.Channels;
      for (let i = 0; i < channels.length; i++) {
        let channel = channels[i];
        let option = document.createElement("option");
        option.value = channel.Name;
        option.dataset.id = channel.ID;
        slackChannelDatalist.appendChild(option);
      }
    }
  }
}

async function onSlackSetChannelBtnClicked() {
  let channel = slackChannelInput.value;

  // Check if input matches regex for a slack channel id.
  let id = "0";
  if (channel.match("[A-Z0-9]{11}$")) {
    id = channel;
  } else {
    let element = slackChannelDatalist.querySelector(`option[value="${channel}"]`);
    if (element !== null) {
      id = element.dataset.id;
    }
  }
  let resp = await v2api.put("/slack/channel", {ChannelId: id});
  let data = await resp.json();
  if (v2api.checkErrorCode(data, 0) !== true) {
    Feedback.alertDanger(`Failed to set channel. Error: ${data.Details}`);
  } else {
    Feedback.alertSuccess("Channel set.");
  }
}

async function onSlackTestPostMessageBtnClicked() {
  let resp = await v2api.post("/slack/postTestMessage");
  let data = await resp.json();
  if (v2api.checkErrorCode(data, 0) !== true) {
    Feedback.alertDanger(`Failed to post message to Slack. Error: ${data.Details}`);
  }
}

// => EVENT LISTENERS
slackChannelInput.addEventListener("input", onSlackChannelInputChanged);
slackSetChannelBtn.addEventListener("click", onSlackSetChannelBtnClicked);
slackTestPostMessageBtn.addEventListener("click", onSlackTestPostMessageBtnClicked);

/* UPLOAD TAB */
// => DOM ELEMENTS
let batchSlideFileInput = document.getElementById("batch-slide-file-input");
let conclusionSelect = document.getElementById("conclusion-slide-type-select");
let introSelect = document.getElementById("intro-slide-type-select");
let modalIntroCaption = document.getElementById("modal-intro-caption");
let modalIntroPreview = document.getElementById("modal-intro-preview");
let lateSelect = document.getElementById("late-slide-type-select");
let modalLateCaption = document.getElementById("modal-late-caption");
let modalLatePreview = document.getElementById("modal-late-preview");
let modalConclusionCaption = document.getElementById("modal-conclusion-caption");
let modalConclusionPreview = document.getElementById("modal-conclusion-preview");
let modalTechDiffCaption = document.getElementById("modal-techdiff-caption");
let modalTechDiffPreview = document.getElementById("modal-techdiff-preview");
let techDiffSelect = document.getElementById("technical-difficulty-slide-type-select");
let uploadDescriptor = document.getElementById("slide-upload-descriptor");

let batchSlideUploadBtn = document.getElementById("batch-slide-upload-btn"); // todo Make this function less specific as well. Verify files based on extension.
let editSlideBtn = document.getElementById("edit-slide-btn");
let editSlideCloseBtn = document.getElementById("edit-slide-close-btn");
let editSlideSaveBtn = document.getElementById("edit-slide-save-btn");

// => PRIMITIVE AND OTHER TYPES
let slideTypeSelects = [introSelect, lateSelect, techDiffSelect, conclusionSelect];
let extensionToMethod = {
  "music": ["mp3", "ogg", "wav"],
  "ppt": ["ppt", "pptm", "pptx"],
  "slide": ["png", "jpg", "jpeg"],
  "video": ["mp4", "mov"],
  "pdf": ["pdf"],
};
let formInput = [];
let typeToKeyWords = {
  "intro": ["intro"],
  "late" : ["late"],
  "conclusion": ["conclusion"],
  "technicalDifficulty": ["technical difficulty",
    "technical difficulties",
    "tech difficulty",
    "tech difficulties",
    "tech diff",
    "technicaldifficulty",
    "technicaldifficulties",
    "techdifficulty",
    "techdifficulties",
    "techdiff"
  ]
};

// => METHODS
function batchFileInputChanged() {
  // Sort files into categories.
  let [slideFiles, musicFiles, videoFiles, pdfFiles, pptFiles, unknownFiles] = SortFilesByExtension(batchSlideFileInput.files);
  // Categorize slides by keywords for upload.
  let [introSlide, lateSlide, techDiffSlide, conclusionSlide, customSlides] = CategorizeSlideFilesByKeywordForUpload(slideFiles);
  repopulateFormInputAndUploadDescriptor(introSlide, lateSlide, techDiffSlide, conclusionSlide, customSlides, musicFiles, videoFiles, pdfFiles, pptFiles, unknownFiles);
}

function clearFormInputAndUploadDescriptor() {
  formInput = [];
  uploadDescriptor.innerHTML = "";
}

function editSlideBtnClicked() {
  // Iterate through slide type selects.
  for (let select of slideTypeSelects) {
    // Clear all but first option.
    while (select.options.length > 1) {
      select.removeChild(select.lastChild);
    }
    // Create option for every slide.
    for (let i = 0; i < formInput.length; i++) {
      // Skip if not a slide.
      if (formInput[i].type !== "slide") continue;
      let option = document.createElement("option");
      option.value = i.toString();
      option.innerText = formInput[i].ogName;
      select.appendChild(option);
      // Select option if it's name matches the slide type.
      if (formInput[i].assignTo.includes(select.dataset.type)) {
        select.selectedIndex = i + 1;
      }
    }
  }
  // Update previews.
  updateEditSlideAssignmentPreviewElement(introSelect, modalIntroPreview, modalIntroCaption);
  updateEditSlideAssignmentPreviewElement(lateSelect, modalLatePreview, modalLateCaption);
  updateEditSlideAssignmentPreviewElement(techDiffSelect, modalTechDiffPreview, modalTechDiffCaption);
  updateEditSlideAssignmentPreviewElement(conclusionSelect, modalConclusionPreview, modalConclusionCaption);
}

function editSlideSaveBtnClicked() {
  // Sort files into categories.
  let [slideFiles, musicFiles, videoFiles, pdfFiles, pptFiles, unknownFiles] = SortFilesByExtension(batchSlideFileInput.files);
  // Categorize slides by slide type selects.
  let [introSlide, lateSlide, techDiffSlide, conclusionSlide, customSlides] = CategorizeSlideFilesBySlideTypeSelects(slideFiles);
  repopulateFormInputAndUploadDescriptor(introSlide, lateSlide, techDiffSlide, conclusionSlide, customSlides, musicFiles, videoFiles, pdfFiles, pptFiles, unknownFiles);
}

function CategorizeSlideFilesByKeywordForUpload(files) {
  let introSlide = undefined;
  let lateSlide = undefined;
  let techDiffSlide = undefined;
  let conclusionSlide = undefined;
  let customSlides = [];
  let accountedSlides = [];

  for (let i = 0; i < files.length; i++) {
    let file = files[i];

    // Identify the type of slide being uploaded.
    if (!Object.keys(typeToKeyWords).some(tKey => {

      // Check if type is already accounted for.
      if (accountedSlides.includes(tKey)) return false;
      let keywords = typeToKeyWords[tKey]; // Get keywords associated with type.

      // Search for keywords in file name.
      if (keywords.some(keyword => file.name.toLowerCase().includes(keyword))) {
        accountedSlides.push(tKey);
        switch (tKey) {
          case "intro":
            introSlide = file;
            break;
          case "late":
            lateSlide = file;
            break;
          case "technicalDifficulty":
            techDiffSlide = file;
            break;
          case "conclusion":
            conclusionSlide = file;
            break;
        }
        return true;
      }
      return false; // keep looking.
    })) {
      // Type could not be identified. Will upload as custom slide.
      customSlides.push(file);
    }
  }
  return [introSlide, lateSlide, techDiffSlide, conclusionSlide, customSlides];
}

function CategorizeSlideFilesBySlideTypeSelects(files) {
  let introSlide = undefined;
  let lateSlide = undefined;
  let techDiffSlide = undefined;
  let conclusionSlide = undefined;
  let customSlides = [];

  // Iterate through files from batch slide file input.
  for (let i = 0; i < files.length; i++) {
    let file = files[i];
    let select = slideTypeSelects.filter(select => {
      if (select.selectedIndex === 0) return false; // Skip if no option selected.
      // Check if file name matches select value.
      let idx = parseInt(select.value);
      if (isNaN(idx)) return false;
      return file.name === formInput[idx].ogName;
    }); // Find slide type from select.

    if (select.length > 0) {
      // if assigned to multiple types, find all types.
      for (let i = 0; i < select.length; i++) {
        switch (select[i].dataset.type) {
          case "intro":
            introSlide = file;
            break;
          case "late":
            lateSlide = file;
            break;
          case "technicalDifficulty":
            techDiffSlide = file;
            break;
          case "conclusion":
            conclusionSlide = file;
            break;
        }
      }

    } else {
      // Slide was not assigned with any select. Will upload as custom slide.
      customSlides.push(file);
    }
  }
  return [introSlide, lateSlide, techDiffSlide, conclusionSlide, customSlides];
}

function repopulateFormInputAndUploadDescriptor(introSlide, lateSlide, techDiffSlide, conclusionSlide, customSlides, musicFiles, videoFiles, pdfFiles, pptFiles, unknownFiles) {
  clearFormInputAndUploadDescriptor();
  if (unknownFiles.length > 0) {
    // Print "Unknown file(s) file1, file2, file3, etc. will not be uploaded."
    uploadDescriptor.innerHTML += `${unknownFiles.length} unknown file(s) `;
    for (let i = 0; i < unknownFiles.length; i++) {
      uploadDescriptor.innerHTML += `'${unknownFiles[i].name}'`;
      if (i !== unknownFiles.length - 1) {
        uploadDescriptor.innerHTML += ", ";
      }
    }
    uploadDescriptor.innerHTML += " will not be uploaded.<br>";
  }
  // Push intro slide.
  if (introSlide) {
    pushFormInput(introSlide, "slide", ["intro"]);
    uploadDescriptor.innerHTML += `'${introSlide.name}' will be used as your Intro Slide.<br>`;
  }
  // Push late slide.
  if (lateSlide) {
    pushFormInput(lateSlide, "slide", ["late"]);
    uploadDescriptor.innerHTML += `'${lateSlide.name}' will be used as your Late Slide.<br>`;
  }
  // Push tech diff slide.
  if (techDiffSlide) {
    pushFormInput(techDiffSlide, "slide", ["technicalDifficulty"]);
    uploadDescriptor.innerHTML += `'${techDiffSlide.name}' will be used as your Technical Difficulty Slide.<br>`;
  }

  // Push conclusion slide.
  if (conclusionSlide) {
    pushFormInput(conclusionSlide, "slide", ["conclusion"]);
    uploadDescriptor.innerHTML += `'${conclusionSlide.name}' will be used as your Conclusion Slide.<br>`;
  }

  // Push custom slides.
  uploadDescriptor.innerHTML += "You will be uploading ";
  PushToFormInputAndAppendUploadDescriptor("slide", customSlides, "custom slide");
  PushToFormInputAndAppendUploadDescriptor("music", musicFiles, "music");
  PushToFormInputAndAppendUploadDescriptor("slide", videoFiles, "video");
  PushToFormInputAndAppendUploadDescriptor("pdf", pdfFiles, "pdf");
  PushToFormInputAndAppendUploadDescriptor("ppt", pptFiles, "ppt");

  // Append note if pdf/ppt files are uploaded.
  uploadDescriptor.innerHTML += `${pdfFiles.length > 0 || pptFiles.length > 0 ?
    "<br><strong>Note: PDF/PPT files will be converted into slides, and will take longer to process.</strong>" : ""}`;
  editSlideBtn.style.display = "block"; // Show edit button.

  function PushToFormInputAndAppendUploadDescriptor(type, files, descriptor) {
    for (let file of files) {
      pushFormInput(file, type);
    }
    uploadDescriptor.innerHTML += `${files.length} ${descriptor} file(s), `;
  }
}

function updateEditSlideAssignmentPreviewElement(selectEl, previewEl, captionEl) {
  if (selectEl.selectedIndex === 0) {
    captionEl.innerHTML = "No slide selected to preview";
    previewEl.src = "...";
    previewEl.classList.add("d-none");
  } else {
    let idx = parseInt(selectEl.value);
    if (isNaN(idx)) return;
    let input = formInput[idx];
    captionEl.innerHTML = `${input.ogName} will be used as your ${selectEl.dataset.type} slide.`;
    previewEl.classList.remove("d-none");
    fileReaderHelper(previewEl, input.file);
  }
}

// loads file preview based on user selection
function fileReaderHelper(previewEl, file) {
  const fileReader = new FileReader();
  fileReader.onload = e => {
    previewEl.src = e.target.result;
  }
  fileReader.readAsDataURL(file);
}

function FetchAllUploadedMediaAndUpdateDash() {
  onSlideTabClicked(); // Fetch custom slides.
  onMusicTabClicked(); // Fetch holding music.
  onVideoTabClicked(); // Fetch videos.
}

function pushFormInput(file, type, assignTo = []) {
  // Check if file is already in form input.
  for (let i = 0; i < formInput.length; i++) {
    if (formInput[i].file.name === file.name) {
      // Union assignTo arrays.
      formInput[i].assignTo = [...new Set([...formInput[i].assignTo, ...assignTo])];
      return;
    }
  }
  formInput.push({
    type: type,
    assignTo: assignTo,
    ogName: file.name,
    file: file
  });
}

function SortFilesByExtension(files) {
  let slideFiles = [];
  let musicFiles = [];
  let videoFiles = [];
  let pdfFiles = [];
  let pptFiles = [];
  let unknownFiles = [];

  for (let i = 0; i < files.length; i++) {
    let file = files[i];
    let extension = file.name.split(".").pop().toLowerCase();
    if (extensionToMethod["slide"].includes(extension)) {
      slideFiles.push(file);
    } else if (extensionToMethod["music"].includes(extension)) {
      musicFiles.push(file);
    } else if (extensionToMethod["video"].includes(extension)) {
      videoFiles.push(file);
    } else if (extensionToMethod["pdf"].includes(extension)) {
      pdfFiles.push(file);
    } else if (extensionToMethod["ppt"].includes(extension)) {
      pptFiles.push(file);
    } else {
      unknownFiles.push(file);
    }
  }
  return [slideFiles, musicFiles, videoFiles, pdfFiles, pptFiles, unknownFiles];
}

function UpdateBrowsePreviewElement(lmtRoute, element, select, srcRoute) {
  fetch(`${lmtRoute}/{element.value}`)
    .then(value => value.json())
    .then(value => {
      let lastModifiedTime;
      lastModifiedTime = value.lastUpdate;
      element.src = `${srcRoute}/${select.value}?${lastModifiedTime.toString()}`;
    });
}

function UpdateOptionGroupWithValues(optionGroup, options) {
  // Clear existing options.
  while (optionGroup.firstChild) {
    optionGroup.removeChild(optionGroup.firstChild);
  }
  // Create option for every slide.
  for (let i = 0; i < options.length; i++) {
    let option = document.createElement("option");
    option.value = options[i];
    option.innerText = options[i];
    optionGroup.appendChild(option);
  }
}

function uploadCustomSlideClicked() {
  // Hide edit button.
  editSlideBtn.style.display = "none";
  let parentTracker = document.getElementById("uploadTrackerContainer");
  batchSlideUploadBtn.disabled = true;

  let upload = function (input) {
    return new Promise(function (resolve, reject) {
      let formData = new FormData();
      formData.append("type", input.type);
      formData.append(input.ogName, input.file);

      let request = new XMLHttpRequest();
      createUploadProgressTracker(parentTracker, request, input.ogName);
      request.onload = function () {
        if (request.status >= 200 && request.status < 300) {
          resolve(request.response);
          if (input.assignTo !== []) {
            let assignTo2Route = {
              "intro": "/assignIntroSlide",
              "late": "/assignLateSlide",
              "technicalDifficulty": "/assignTechnicalDifficultySlide",
              "conclusion": "/assignConclusionSlide"
            }
            for (let i = 0; i < input.assignTo.length; i++) {
              unityFetch(`${assignTo2Route[input.assignTo[i]]}?url=/slides/${input.ogName}`, { method: "PUT" })
                .then((resp) => {
                  if (resp.ok) {
                    console.log("Slide assigned.")
                  }
                });
            }
          }
        } else {
          reject(request.statusText);
        }
      };
      request.open("POST", "/slide_upload");
      request.send(formData);
    })
  }

  let uploads = formInput.map((input) => { return upload(input); });

  // After all files are done uploading re-enable upload button.
  Promise.allSettled(uploads).then(() => {
    batchSlideUploadBtn.disabled = false;
    if (uploads.length > 0) {
      batchSlideFileInput.value = "";
      uploadDescriptor.innerHTML = "Click browse to look for files to upload.";
      clearFormInputAndUploadDescriptor();
      Feedback.alertSuccess("Upload complete!");
      FetchAllUploadedMediaAndUpdateDash();
      FetchAssignedHoldingSlidesAndUpdatePreviews();
    }
  })
}

// => EVENT LISTENERS
batchSlideFileInput.addEventListener("change", batchFileInputChanged); // todo make this function less specific to slide uploads.
batchSlideUploadBtn.addEventListener("click", uploadCustomSlideClicked);
editSlideBtn.addEventListener("click", editSlideBtnClicked);
editSlideSaveBtn.addEventListener("click", editSlideSaveBtnClicked);
videoSelect.addEventListener("change", UpdateVideoBrowsePreviewElement);


conclusionSelect.addEventListener("change", () => {
  updateEditSlideAssignmentPreviewElement(conclusionSelect, modalConclusionPreview, modalConclusionCaption);
});

introSelect.addEventListener("change", () => {
  updateEditSlideAssignmentPreviewElement(introSelect, modalIntroPreview, modalIntroCaption);
});

lateSelect.addEventListener("change", () => {
  updateEditSlideAssignmentPreviewElement(lateSelect, modalLatePreview, modalLateCaption);
});

techDiffSelect.addEventListener("change", () => {
  updateEditSlideAssignmentPreviewElement(techDiffSelect, modalTechDiffPreview, modalTechDiffCaption);
});

// => INIT(S)
editSlideBtn.style.display = "none";

FetchAllUploadedMediaAndUpdateDash(); // Update Initially

/* CONFIGURATION TAB */
// => DOM ELEMENTS
let configFileInput = document.getElementById("config-file-input");

let configDownloadBtn = document.getElementById("config-download-btn");
let configUploadBtn = document.getElementById("config-upload-btn");

// => EVENT LISTENERS
configUploadBtn.addEventListener("click", function () {

  if (configFileInput.value === "") {
    Feedback.alertDanger("No file selected.");
    return;
  }
  configUploadBtn.disabled = true;
  let parentTracker = document.getElementById("configTrackerContainer");

  let file = configFileInput.files[0];
  let formData = new FormData();
  formData.append("config", file);

  let request = new XMLHttpRequest();
  createUploadProgressTracker(parentTracker, request, "config");
  request.onload = function () {
    if (request.status >= 200 && request.status < 300) {
      console.log("Config File Uploading");
    } else {
      console.log(request.response);
    }
  }

  request.onloadend = function () {
    if (request.status >= 200 && request.status < 300) {
      console.log("Config File Uploaded.");
      FetchAllUploadedMediaAndUpdateDash();
    } else {
      console.log("Config Upload Failed.");
    }
    configFileInput.value = "";
    configUploadBtn.disabled = false;
  }

  request.open("PUT", `uapp/setConfig`);
  request.send(formData);
});

configDownloadBtn.addEventListener("click", function () {
  unityFetch("/getConfig", { method: "GET" })
    .then((resp) => {
      if (resp.ok) {
        resp.blob().then((blob) => {
          let url = window.URL.createObjectURL(blob);
          let a = document.createElement('a');
          a.href = url;
          a.download = "config.zip";
          a.click();
          a.remove();
        })
      }
    })
});

/* LOG TAB */
// => DOM ELEMENTS
let listLogFileOptions = document.getElementById("list-all-log-files");

let logDownloadBtn = document.getElementById("log-download-btn");

// => METHODS
function downloadLog() {
  let fname = listLogFileOptions.value;
  let client = new XMLHttpRequest();
  client.open("GET", "/download_log/" + fname);
  client.responseType = "blob";
  client.send();

  // starts the download.
  client.onload = function (e) {
    if (this.readyState == 4 && this.status == 200) {
      let blob = new Blob([this.response], { type: 'document' })
      const href = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), {
        client: client,
        href: href,
        style: "display:none",
        download: fname,
      });
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(href);
      a.remove();
    }
  }
  // track progress during the download.
  client.onprogress = function (e) { logDownloadBtn.disabled = true; }

  // when download is complete.
  client.onloadend = function (e) {
    logDownloadBtn.innerHTML = "Downloaded!";
    setTimeout(() => {
      logDownloadBtn.innerHTML = "Download Log";
      logDownloadBtn.disabled = false; // re-enable download button
    }, 1000);
  }
}

function fetchLogs() {
  unityFetch("/getLog")
    .then(resp => resp.text())
    .then((data) => {
      let log = document.getElementById("log-div");
      data = data.replaceAll("\n", "<br>")
      data = data.replaceAll("\r", "<br>")
      data = data.replaceAll("\t", "&nbsp;&nbsp;&nbsp;&nbsp;")
      log.innerHTML = data;
    });
}

async function listAvailableLogs() {
  let resp = await fetch("/logs");
  let files = await resp.json();

  if (listLogFileOptions.childElementCount > files.length + 1) {
    while (listLogFileOptions.childElementCount > files.length + 1) {
      listLogFileOptions.removeChild(listFileOptions.lastChild);
    }
  } else {
    while (listLogFileOptions.childElementCount < files.length + 1) {
      let option = document.createElement("option");
      listLogFileOptions.appendChild(option);
    }
  }

  for (let i = files.length - 1; i >= 0; i--) {
    let option = listLogFileOptions.children[i + 1];
    option.value = files[i];
    option.innerText = files[i];
  }
}

function onLogDownloadClicked() {
  if (listLogFileOptions.value === "none") {
    Feedback.alertDanger("Please select a log file to download.");
  } else {
    downloadLog();
  }
}

function onLogMessageNotification() {
  if (navLogTabBtn.classList.contains("active")) {
    fetchLogs();
  }
}

// => EVENT LISTENERS
listLogFileOptions.addEventListener("click", listAvailableLogs);
logDownloadBtn.addEventListener("click", onLogDownloadClicked);

/* RECORDING TAB */
// => DOM ELEMENTS
let listFileOptions = document.getElementById("list-all-files");
let recordingFieldset = document.getElementById("recording-fieldset");
let progress = document.getElementById("progress");
let progressField = document.getElementById("progress-field");
let progressText = document.getElementById("progress-text");
let remainingText = document.getElementById("remaining-text");

let recordingDownloadBtn = document.getElementById("recording-download");

// => METHODS
function downloadFile() {

  // init and make a request.
  let fname = listFileOptions.value;
  let client = new XMLHttpRequest();
  client.open("GET", "/download/" + fname);
  client.responseType = "blob";
  client.send();

  let start = new Date().getTime();

  // starts the download.
  client.onload = function (e) {
    if (this.readyState == 4 && this.status == 200) {
      let blob = new Blob([this.response], { type: 'video/mp4' })
      const href = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), {
        client: client,
        href: href,
        style: "display:none",
        download: fname,
      });
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(href);
      a.remove();
    }
  }

  // track progress during the download.
  client.onprogress = function (e) {

    progressField.classList.remove("d-none"); // display the download progress
    recordingDownloadBtn.disabled = true; // disable download button during download

    if (e.lengthComputable) {
      progress.max = e.total;
      progress.value = e.loaded;

      let percent = (e.loaded / e.total) * 100;
      percent = Math.floor(percent);
      progressText.innerHTML = percent + "%";

      let end = new Date().getTime();
      let duration = (end - start) / 1000;
      let bps = e.loaded / duration;
      let kbps = Math.floor(bps / 1024);

      let time = (e.total - e.loaded) / bps;
      let min = Math.floor(time / 60);
      let sec = Math.floor(time % 60);
      remainingText.innerHTML = kbps + " KB/s. remaining time: " + min + " minute(s) " + sec + " second(s).";
    }
  }
  // when download is complete.
  client.onloadend = function (e) {
    progress.value = e.loaded;
    remainingText.innerHTML = "Done!";

    setTimeout(() => {
      recordingDownloadBtn.disabled = false; // re-enable download button
      progressField.classList.add("d-none");// hide the download progress
      // reset
      progress.value = "0";
      progress.max = "1";
      remainingText.innerHTML = "";
      progressText.innerHTML = "";
      listFileOptions.value = "none";
    }, 2000);
  }
}

function handleRecordingDownload() {
  if (listFileOptions.value === "none") {
    Feedback.alertDanger("Please select a file from the options below.");
  } else {
    downloadFile();
  }
}

async function listAvailableRecordings() {
  await updateSettings();
  let resp = await fetch("/listRecordings");
  let files = await resp.json();

  if (listFileOptions.childElementCount > files.length + 1) {
    while (listFileOptions.childElementCount > files.length + 1) {
      listFileOptions.removeChild(listFileOptions.lastChild);
    }
  } else {
    while (listFileOptions.childElementCount < files.length + 1) {
      let option = document.createElement("option");
      listFileOptions.appendChild(option);
    }
  }

  for (let i = files.length - 1; i >= 0; i--) {
    let option = listFileOptions.children[i + 1];
    option.value = files[i].file;
    option.innerText = files[i].file;
  }
}

// => EVENT LISTENERS
listFileOptions.addEventListener("click", listAvailableRecordings);
recordingDownloadBtn.addEventListener("click", handleRecordingDownload);

/* BRING NAV-TABS INTO VIEW*/
// => DOM ELEMENTS
let navZoomTabBtn = document.getElementById("nav-zoom-tab");
let navPartTabBtn = document.getElementById("nav-participants-tab");
let navLayoutTabBtn = document.getElementById("nav-layout-tab");
let navSceneTabBtn = document.getElementById("nav-scenes-tab");
let navSlideTabBtn = document.getElementById("nav-slide-tab");
let navMusicTabBtn = document.getElementById("nav-music-tab");
let navVideoTabBtn = document.getElementById("nav-video-tab");
let navLogTabBtn = document.getElementById("nav-log-tab");
let navSlackTabBtn = document.getElementById("nav-slack-tab");
let navUploadTabBtn = document.getElementById("nav-upload-tab");
let navRecordingTabBtn = document.getElementById("nav-recording-tab");

// => EVENT LISTENERS
navZoomTabBtn.addEventListener("click", () => {
  navZoomTabBtn.scrollIntoView();
});
navPartTabBtn.addEventListener("click", () => {
  navPartTabBtn.scrollIntoView();
});
navLayoutTabBtn.addEventListener("click", () => {
  navLayoutTabBtn.scrollIntoView();
});
navSceneTabBtn.addEventListener("click", () => {
  onSceneTabClicked();
  navSceneTabBtn.scrollIntoView();
});
navSlideTabBtn.addEventListener("click", () => {
  onSlideTabClicked();
  navSlideTabBtn.scrollIntoView();
});
navMusicTabBtn.addEventListener("click", () => {
  onMusicTabClicked();
  navSlideTabBtn.scrollIntoView();
});
navVideoTabBtn.addEventListener("click", () => {
  onVideoTabClicked();
  navVideoTabBtn.scrollIntoView();
});
navLogTabBtn.addEventListener("click", () => {
  navLogTabBtn.scrollIntoView();
  fetchLogs();
});
navSlackTabBtn.addEventListener("click", () => {
  navSlackTabBtn.scrollIntoView();
});
navUploadTabBtn.addEventListener("click", () => {
  navUploadTabBtn.scrollIntoView();
});
navRecordingTabBtn.addEventListener("click", () => {
  navRecordingTabBtn.scrollIntoView();
});

/* ADVANCED SETTINGS */
// => DOM ELEMENTS
let advancedSettingsToggle = document.getElementById("advancedSettingsToggle");

// => METHODS
function enableAdvancedSettings() {
  onEnableAdvancedSettings(advancedSettingsToggle, navZoomTabBtn, streamAuthSettings, navLogTabBtn, resetModalBtn);
  localStorage.setItem("advancedSettingsEnabled", advancedSettingsToggle.checked);
}
// => EVENT LISTENERS
advancedSettingsToggle.addEventListener("change", () => { enableAdvancedSettings() });

// => INIT
advancedSettingsToggle.checked = localStorage.getItem("advancedSettingsEnabled") === "true";
enableAdvancedSettings()

/*** APP STATUS METHOD ***/
let appStatus;

function appStatusReceived(json) {

  appStatus = JSON.parse(json);

  if (appStatus.sessionTitle && appStatus.sessionTitle !== ""){
    document.title = appStatus.sessionTitle;
  }

  updateGeneralStatBar();
  updateToggleOutputPreviewBtn(appStatus)

  StyleHelper.ActivateButtonHelper(pendingBtn, false);
  StyleHelper.ActivateButtonHelper(lateBtn, false);
  StyleHelper.ActivateButtonHelper(liveBtn, false);
  StyleHelper.ActivateButtonHelper(technicalDiffBtn, false);
  StyleHelper.ActivateButtonHelper(archiveBtn, false);

  addParticipantSelectCheckEventListener(); // adds event listeners to each select checkbox

  toggleZoomAudioMuteBtn.innerHTML = appStatus.zoomAudioMuted ? "Unmute Zoom Audio" : "Mute Zoom Audio";
  volumeRangeZoom.value = appStatus.currentZoomAudioVolume;
  zoomVolumeLevel.innerHTML = getVolumeLevel(volumeRangeZoom.value);
  toggleMasterAudioMuteBtn.innerHTML = appStatus.masterAudioMuted ? "Unmute Master Audio" : "Mute Master Audio";
  volumeRangeMaster.value = appStatus.masterVolume;
  masterVolumeLevel.innerHTML = getVolumeLevel(volumeRangeMaster.value);

  updateCurrentLayout(appStatus.currentLayout, appStatus.currentScreenSharePreferTop, appStatus.currentScreenSharePreferLeft);
  updateCurrentTextSize(appStatus.lowerThirdDisplayOption);
  updateCurrentLowerThirdStyle(appStatus.currentLowerThirdStyle);
  updateCurrentScreenShareStyleSize(appStatus.currentScreenShareStyleSize);
  if (appStatus.inMeeting || appStatus.meetingSimulated) {
    validateTracksInPlaylist(appStatus.playlist, appStatus.currentlyPlayingIndex);
    meetingNoInputField.disabled = true;
    meetingNumberInput.value = appStatus.meetingId;
    joinMeetingBtn.disabled = true;
    pendingBtn.disabled = false;
    streamControlLoadSceneBtn.disabled = false;
    holdMusicFieldset.disabled = false;
    musicPlayStopBtn.innerHTML = appStatus.playingHoldingMusic ? '<i class="bi bi-stop"></i>' : '<i class="bi bi-play"></i>';
    currentlyPlayingSpan.innerHTML = currentlyPlayingSpan.title = appStatus.currentlyPlayingTrack;
    volumeRangeMusic.value = appStatus.holdingMusicVolume;
    volumeLevelMusic.innerHTML = getVolumeLevel(volumeRangeMusic.value);
    musicLoopBtn.innerHTML = appStatus.loopingHoldingMusic ? 'Loop' : '<s>Loop</s>';
    musicLoopBtn.classList.toggle("btn-primary", appStatus.loopingHoldingMusic);
    musicLoopBtn.classList.toggle("btn-dark", !appStatus.loopingHoldingMusic);

    //videoFieldsetBar.disabled = !jsonParsed.videoIsShowing;
    volumeRangeVideo.value = appStatus.currentVideoVolume;
    volumeLevelVideo.innerHTML = getVolumeLevel(volumeRangeVideo.value);
    musicProgress.max = Math.round(appStatus.currentTrackDuration);
    videoProgress.max = Math.round(appStatus.currentVideoDuration);
    videoPlayPauseBtn.innerHTML = appStatus.playingVideo ? '<i class="bi bi-pause"></i>' : '<i class="bi bi-play"></i>';
    videoLoopBtn.innerHTML = appStatus.loopingVideo ? 'Loop' : '<s>Loop</s>';
    videoLoopBtn.classList.toggle("btn-primary", appStatus.loopingVideo);
    videoLoopBtn.classList.toggle("btn-dark", !appStatus.loopingVideo);

    if (appStatus.streaming) {
      updateStreamButtons();
    } else {
      resetStreamButtonsOnLeaveOrEnd();
    }
  } else{
    resetStreamButtonsOnLeaveOrEnd();
    meetingNoInputField.disabled = false;
    joinMeetingBtn.disabled = false;
    holdMusicFieldset.disabled = true;
    pendingBtn.disabled = true;
    streamControlLoadSceneBtn.disabled = true;
    //videoFieldsetBar.disabled = true;
  }
}
