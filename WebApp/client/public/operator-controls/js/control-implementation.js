/*
This file contains the implementations of our controls, including zoom controls, participant management, stream settings
 and logging.
 */
import { OperatorControls } from "/operator-controls/js/control-map.gen.js";
import { sendClickEvent, sendStringSubmitEvent } from "/videoplayer/js/register-events.js";
import { myVideoPlayer, mainNotifications } from "/operator-controls/js/control-main.js";
import { ValidateClonesWithJsonArray} from "/operator-controls/js/validation-helper.js";
import { unityFetch } from "../../js/unity-fetch.js";
import {getVideoThumb} from "../../js/video-thumbnail.js";
import { createUploadProgressTracker } from "../../js/progresstracker.js";


mainNotifications.addEventListener('setup', function () {
  myVideoPlayer.onParticipantDataReceived = participantDataReceived;
  myVideoPlayer.onAppStatusReceived = appStatusReceived;
  myVideoPlayer.onStyleSchemaReceived = onReceiveStyleSchema;
  myVideoPlayer.onStyleValuesReceived = onReceiveStyleValues;
  myVideoPlayer.onLogMessageNotification = onLogMessageNotification;
});

function onLogMessageNotification () {
  if (navLogTabBtn.classList.contains("active")){
    fetchLogs();
  }
}

function fetchLogs(){
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

/* SIGN OUT MODAL ELEMENTS */
let signOutModal = document.getElementById("signout-modal")
signOutModal.addEventListener('shown.bs.modal', function () {
  signOutModal.focus()
})

/* EXTEND */
document.body.addEventListener("click", function() {

  setTimeout(function(){
    extend();
  }, 700)});

async function extend() {
  let resp = await fetch("/extend");
  let data = await resp.json();
  if (!data.valid) {
    alert("Your session has expired! You're being redirected...");
    window.location = window.location.origin;
  }
}

/* PARTICIPANT ACTION BUTTONS ON VIDEO ELEMENT */
let previewVideoContainer = document.getElementById("preview-video-container");
let participantOnVidCtrlOg = document.getElementById("participant-on-vid-ctrl-og");
let participantOnVidCtrls = [];

function validateParticipantOnVidCtrls() {
  let setupCtrl = function (clone){
    setupParticipantOnVidCtrl(clone, participantOnVidCtrls.length - 1)
  }
  let validateCtrl = function (ctrl, data) {
    ctrl.style.top = (100 * data.top) + "%"
    ctrl.style.left = (100 * data.left) + "%"
    ctrl.style.width = (100 * data.width) + "%"
  }
  ValidateClonesWithJsonArray(participantOnVidCtrlOg, previewVideoContainer, participantOnVidCtrls, setupCtrl, participantJsonParsed, validateCtrl)
}

/* RENAME MODAL ELEMENTS */
let renameModal = document.getElementById("rename-modal")
let participantName = document.getElementById("participant-rename")
let renameButton = document.getElementById("rename-btn")
let participantToRename;
//TODO ALERT IF ANY ERRORS
renameButton.addEventListener("click", function() {
  let p = participantJsonParsed[participantToRename];
  let str = p.id + "," + participantName.value;
  sendStringSubmitEvent(myVideoPlayer, OperatorControls._SetParticipantDisplayName, str);
})
renameModal.addEventListener('shown.bs.modal', function () {
  renameModal.focus()
})

let currentlyDraggedPov

function setupParticipantOnVidCtrl(node, idx) {
  let dragEl = document.querySelector(`div#${node.id} .participant-on-vid-drag`);
  let eyeEl = document.querySelector(`div#${node.id} .participant-on-vid-eye`);
  let earEl = document.querySelector(`div#${node.id} .participant-on-vid-ear`);
  let muteEl = document.querySelector(`div#${node.id} .participant-on-vid-mute`);
  let renameEl = document.querySelector(`div#${node.id} a[target="action-rename"]`);
  let showLtEl = document.querySelector(`div#${node.id} a[target="action-show-lt"]`);
  // let camEl = document.querySelector(`div#${node.id} .participant-on-vid-cam`);

  node.classList.remove("d-none");

  dragEl.ondragstart = (ev) => {
    currentlyDraggedPov = node
  }

  dragEl.ondragover = (ev) => {
    ev.preventDefault()
  }

  dragEl.ondrop = (ev) => {
    ev.preventDefault()
    if (currentlyDraggedPov !== node) {
      let currentIdx = participantOnVidCtrls.indexOf(currentlyDraggedPov);
      let droppedIdx = participantOnVidCtrls.indexOf(node);
      let p1 = participantJsonParsed[currentIdx];
      let p2 = participantJsonParsed[droppedIdx];
      let str = p1.id + "," + p2.id;
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._SwapParticipantsButton, str);
    }
  }

  earEl.addEventListener("click", function () {
    let p = participantJsonParsed[idx];
    unityFetch(`/toggleParticipantAudibility?participantId=${p.id}&enable=${!p.audible}`, {method: "PUT"})
      .then(resp => {
        if (resp.ok) {
          console.log("audibility toggled")
        }
      })
  })

  eyeEl.addEventListener("click", function () {
    let p = participantJsonParsed[idx];
    let str = p.id + "," + !p.visible;
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._ToggleParticipantVisibilityButton, str);
  })

  muteEl.addEventListener("click", function () {
    let p = participantJsonParsed[idx];
    if (p.muted){
      let str = p.id + ",false";
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._MuteParticipantButton, str);
    } else {
      console.log("Only can mute from zoom");
    }
  })

  renameEl.addEventListener("click", function() {
    let p = participantJsonParsed[idx];
    participantName.value = p.username;
    participantToRename = idx;
  })

  showLtEl.addEventListener("click", function(ev) {
    ev.preventDefault();
    let p = participantJsonParsed[idx];
    let str = p.id.toString();
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._ToggleParticipantLowerThird, str);
  })
}

/* CONTROL TAB ELEMENTS */
let meetingNoInput = document.getElementById("meeting-number-input");
let meetingNoInputField = document.getElementById("meeting-number-input-field");
meetingNoInput.addEventListener("change", () => {
  localStorage.setItem("urlOrNumber", meetingNoInput.value);
  console.log(meetingNoInput.value)
})
meetingNoInput.value = localStorage.getItem("urlOrNumber");

/* STREAM PREFERENCES MODAL ELEMENTS */
let streamPrefModal = document.getElementById("stream-pref-modal")
let serverAddressSelect = document.getElementById('serverAddressSelect')
let viewModal = document.getElementById("view-modal")

let streamSettingsBtn = document.getElementById("stream-settings")
streamSettingsBtn.addEventListener("click", updateStreamPref)

let saveBtn = document.getElementById("save-btn")
saveBtn.addEventListener("click", saveStreamPref)

streamPrefModal.addEventListener('shown.bs.modal', function () {
  saveBtn.disabled = true;
  serverAddressSelect.focus()
})

let streamingServerAdd = document.getElementById("serverAddressSelect");
streamingServerAdd.addEventListener("input", flagStreamPrefChange);

let streamingApp = document.getElementById("serverAppSelect");
streamingApp.addEventListener("input", flagStreamPrefChange);

let streamKey = document.getElementById("stream-key-input");
streamKey.addEventListener("input", flagStreamPrefChange);

let uname = document.getElementById("username-input");
uname.addEventListener("input", flagStreamPrefChange);

let pwd = document.getElementById("password-input");
pwd.addEventListener("input", flagStreamPrefChange);

/* -> Feedback Alerts */
let streamUrl = document.getElementById("url-span");
let successAlert = document.getElementById("success-alert");
let successAlertRename = document.getElementById("success-alert-rename");
let errorMsg = document.getElementById("err-span");
let errorAlert = document.getElementById("error-alert");
let errorAlertFile = document.getElementById("error-alert-file");
let boardData = document.getElementById('kt_clipboard_4');

/* GENERAL STATUS BAR */
let generalStatBar = document.getElementById("general-status-bar");

/* -> clipboard */
const copyData = document.getElementById('kt_clipboard_4');
const copyBtn = document.getElementById('clip');

function flagStreamPrefChange() {

  if (streamKey.value !== "" && uname.value !== ""
    && pwd.value !== "" && streamingApp.value !== "none"
    && streamingServerAdd.value !== "none") {
    saveBtn.disabled = false;
  } else {
    saveBtn.disabled = true;
  }
  //saveBtn.addEventListener("click", updateStreamPref)
}

async function updateStreamPref() {
  let resp = await unityFetch("/getStreamServiceSettings")
  let data = await resp.json();
  if (!resp.ok) {
    console.error("Error " + resp.status + ": " + data.message)
    errorMsg.innerHTML = data.message;
    alertDisplay(errorAlert);
  } else {
    let reg = new RegExp("[:/.]");
    let url = data.streamServiceSettings.server.split(reg);
    streamingServerAdd.value = url[3];
    streamingApp.value = url[6];
    streamKey.value = data.streamServiceSettings.key;
    uname.value = data.streamServiceSettings.username;
    pwd.value = data.streamServiceSettings.password;
    streamUrl.innerHTML = data.streamServiceSettings.server;
    boardData.innerHTML = data.streamServiceSettings.server + data.streamServiceSettings.key;
  }

}

async function saveStreamPref() {
  saveBtn.disabled = true;
  let resp = await unityFetch("/setStreamServiceSettings?" +
    "serverUrl=" + `rtmp://${streamingServerAdd.value}.wsw.com/${streamingApp.value}/` +
    "&streamKey=" + streamKey.value +
    "&username=" + uname.value +
    "&password=" + pwd.value,
    { method: "PUT" })
  if (!resp.ok) {
    errorMsg.innerHTML = resp.statusText;
    alertDisplay(errorAlert, 1000);
  } else {
    await updateStreamPref();
    alertDisplay(successAlert);
  }
}

var clipboard = new ClipboardJS(copyBtn, {
  container: streamPrefModal,
  copyData: copyData,
  text: function () {
    //console.log(copyData.innerHTML);
    return copyData.innerHTML;
  }
});

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
  }, 3000)
});

function alertDisplay(alertType, timeout = 3000) {
  alertType.classList.remove("d-none")
  alertType.classList.add("d-flex")
  setTimeout(() => {
    alertType.classList.remove("d-flex")
    alertType.classList.add("d-none")
  }, timeout)
}


function setupDropdown(dropdown, func) {
  for (let i = 0; i < dropdown.children.length; i++) {
    let child = dropdown.children[i]
    child.firstChild.onclick = function () {
      func(child.value)
    }
  }
}

function participantDataReceived(json) {
  participantJsonParsed = JSON.parse(json);
  validateParticipantInputGroups()
  validateParticipantOnVidCtrls()
}

let currentlyPlayingTrackTime = document.getElementById("currently-playing-track-time")
let holdingMusicTimer = 0;
let musicTimerIntervalId = 0;
let videoTimer = 0;
let videoTimerIntervalId = 0;

function appStatusReceived(json) {

  let jsonParsed = JSON.parse(json)

  ActivateButtonHelper(pendingBtn, false)
  ActivateButtonHelper(technicalDiffBtn, false)
  ActivateButtonHelper(liveBtn, false)
  ActivateButtonHelper(archiveBtn, false)

  addParticipantSelectCheckEventListener(); // adds event listeners to each select checkbox

  generalStatBar.innerHTML =
  `Stream: ${jsonParsed.streaming ? "Yes": "No"} |
  Recording: ${jsonParsed.recording ? "Yes": "No"} |
  Holding Slide: ${jsonParsed.holdingSlide} |
  Holding Music: ${jsonParsed.playingHoldingMusic ? "Playing" : "Not Playing"} | 
  Holding Video: ${jsonParsed. playingVideo ? "Playing" : "Not Playing"}.`

  if (jsonParsed.inMeeting || jsonParsed.meetingSimulated) {
    validateTracksInPlaylist(jsonParsed.playlist, jsonParsed.currentlyPlayingIndex)
    meetingNoInputField.disabled = true;
    joinMeetingBtn.disabled = true;
    leaveMeetingBtn.disabled = false;
    holdMusicFieldset.disabled = false;
    musicPlayStopBtn.innerHTML = jsonParsed.playingHoldingMusic ? "Stop" : "Play";
    currentlyPlayingSpan.innerHTML = jsonParsed.currentlyPlayingTrack;
    if (jsonParsed.playingHoldingMusic) {
      holdingMusicTimer = Math.round(jsonParsed.currentTrackTimeLeft);
      currentlyPlayingTrackTime.innerHTML = `-${holdingMusicTimer}`;
      volumeRangeMusic.value = jsonParsed.holdingMusicVolume;
      if (musicTimerIntervalId === 0) {
        musicTimerIntervalId = setInterval(function () {
          // Decrease the time left by 1 second
          holdingMusicTimer--;
          currentlyPlayingTrackTime.innerHTML = `-${holdingMusicTimer}`;
        }, 1000);
      }
    } else {
      clearInterval(musicTimerIntervalId);
      musicTimerIntervalId = 0;
      currentlyPlayingTrackTime.innerHTML = "";
    }

    videoFieldsetBar.disabled = !jsonParsed.videoIsShowing;

    if (jsonParsed.playingVideo) {

      videoTimer = Math.round(jsonParsed.currentVideoPlaybackTime);
      videoPlaybackTime.innerHTML = videoProgress.value = videoTimer;
      videoVolume.value = jsonParsed.currentVideoVolume;
      if (videoTimerIntervalId === 0) {
        videoTimerIntervalId = setInterval ( function() {
          videoTimer++;
          videoPlaybackTime.innerHTML = videoProgress.value = videoTimer;
        }, 1000);
      }
    } else {
      clearInterval(videoTimerIntervalId);
      videoTimerIntervalId = 0;
      videoPlaybackTime.innerHTML = "00:00";
    }
    videoProgress.max = jsonParsed.currentVideoDuration;
    videoPlayPauseBtn.innerHTML = jsonParsed.playingVideo ? '<i class="bi bi-pause"></i>' : '<i class="bi bi-play"></i>';

    if (jsonParsed.streaming) {
      viewModal.disabled = true;
      pendingBtn.innerHTML = "Intro Slide"
      if (jsonParsed.holdingSlide === "pending") {
        ActivateButtonHelper(pendingBtn, true)
      } else if (jsonParsed.holdingSlide === "technicalDifficulties") {
        ActivateButtonHelper(technicalDiffBtn, true)
      } else if (jsonParsed.holdingSlide === "none" || jsonParsed.isCustomSlide) {
        ActivateButtonHelper(liveBtn, true)
      } else if (jsonParsed.holdingSlide === "endOfStream") {
        ActivateButtonHelper(archiveBtn, true)
      }
    } else {
      pendingBtn.innerHTML = "Start stream"
      viewModal.disabled = false;
      if (jsonParsed.holdingSlide === "endOfStream" || jsonParsed.holdingSlide === "conclusion") {
        sendClickEvent(myVideoPlayer, OperatorControls._LiveButton);
      }
    }

    if (jsonParsed.secondClickEndsStream) {
      archiveBtn.innerHTML = "End Stream"
    } else {
      archiveBtn.innerHTML = "Archive"
    }

  } else {
    generalStatBar.innerHTML = "Connection State: Connected";
    meetingNoInputField.disabled = false;
    joinMeetingBtn.disabled = false;
    leaveMeetingBtn.disabled = true;
    holdMusicFieldset.disabled = true;
    videoFieldsetBar.disabled = true;
  }

  function ActivateButtonHelper(btn, active) {
    if (active) {
      btn.classList.remove("deactivated")
      btn.classList.add("activated")
    } else {
      btn.classList.remove("activated")
      btn.classList.add("deactivated")
    }
  }
}


/* STREAM BUTTONS */
let pendingBtn = document.getElementById("pending-btn");
pendingBtn.addEventListener("click", onPendingClick);
let liveBtn = document.getElementById("live-btn");
liveBtn.addEventListener("click", onLiveClick);
let technicalDiffBtn = document.getElementById("technical-diff-btn")
technicalDiffBtn.addEventListener("click", onTechnicalDiff);
let archiveBtn = document.getElementById("archive-btn")
archiveBtn.addEventListener("click", onArchiveClick);

/* STREAM BUTTON IMPLEMENTATION */
function onPendingClick() {
  sendClickEvent(myVideoPlayer, OperatorControls._PendingButton)
}

function onLiveClick() {
  sendClickEvent(myVideoPlayer, OperatorControls._LiveButton)
}

function onTechnicalDiff() {
  sendClickEvent(myVideoPlayer, OperatorControls._TechnicalDifficultiesButton)
}

function onArchiveClick() {
  sendClickEvent(myVideoPlayer, OperatorControls._ArchiveButton)
}

/* ZOOM CONTROLS */
let meetingNumberInput = document.getElementById("meeting-number-input")
let meetingPasswordInput = document.getElementById("meeting-password-input")
let joinMeetingBtn = document.getElementById("join-meeting-btn")
joinMeetingBtn.addEventListener('click', onJoinClick)
let leaveMeetingBtn = document.getElementById("leave-meeting-btn")
leaveMeetingBtn.addEventListener("click", onLeaveClicked)

/* ZOOM CONTROL IMPLEMENTATION */
function onJoinClick() {
  let str = meetingNumberInput.value + "," + meetingPasswordInput.value;
  sendStringSubmitEvent(myVideoPlayer, OperatorControls._JoinMeetingButton, str);
}

function onLeaveClicked() {
  
  sendClickEvent(myVideoPlayer, OperatorControls._LeaveMeetingButton);
}

/* PARTICIPANT CONTROLS */
let participantJsonParsed;
let participantFieldset = document.getElementById("participant-fieldset");
let showAllLowerThirdsBtn = document.getElementById("show-all-lower-thirds-btn");
showAllLowerThirdsBtn.addEventListener("click", onShowAllLowerThirdsClick);
let hideAllLowerThirdsBtn = document.getElementById("hide-all-lower-thirds-btn");
hideAllLowerThirdsBtn.addEventListener("click", onHideAllLowerThirdsClick);

let enableAutoShowOnJoin = document.getElementById("enable-autoshow-btn");
let disableAutoShowOnJoin = document.getElementById("disable-autoshow-btn");
enableAutoShowOnJoin.addEventListener("click", onEnableAutoShowOnJoin);
disableAutoShowOnJoin.addEventListener("click", onDisableAutoShowOnJoin);

let selectAllParticipantBtn = document.getElementById("check-uncheck-all-ppt-btn");
let showSelectParticipantBtn = document.getElementById("show-select-ppt-btn");
let hideSelectParticipantBtn = document.getElementById("hide-select-ppt-btn");

function addParticipantSelectCheckEventListener() {
  let cbs = document.getElementsByName('checked-participant');
  for (let i = 0; i < cbs.length; i++) {
    cbs[i].addEventListener('change', updateSelectParticipantBtnText);
  }
}

function mapSelectParticiapntsToInputGroups() {
  let arr = participantInputGroups.map(group => {
    return group.querySelector(".check");
  });
  return arr;
}

function updateSelectParticipantBtnText() {
  let counter = 0;
  let selectedParticipants = mapSelectParticiapntsToInputGroups();

  for (let i = 0; i <  selectedParticipants.length; i++) {
    if (selectedParticipants[i].checked) {
      counter++;
    }
  }

  if (counter === selectedParticipants.length) {
    selectAllParticipantBtn.innerHTML = "Unselect All";
  } else {
    selectAllParticipantBtn.innerHTML = "Select All";
  }
}

selectAllParticipantBtn.addEventListener("click", () => {

  if (selectAllParticipantBtn.innerHTML === "Select All") {
    selectAllParticipantBtn.innerHTML = "Unselect All";
    let selectedParticipants = mapSelectParticiapntsToInputGroups();

    for (let i = 0; i <  selectedParticipants.length; i++) {
      selectedParticipants[i].checked = true;
    }
  } else if (selectAllParticipantBtn.innerHTML === "Unselect All") {
    selectAllParticipantBtn.innerHTML = "Select All";
    let selectedParticipants = mapSelectParticiapntsToInputGroups();
    for (let i = 0; i <  selectedParticipants.length; i++) {
      selectedParticipants[i].checked = false;
    }
  }
});

showSelectParticipantBtn.addEventListener("click", () => {
  let selectedParticipants = participantInputGroups.map(group => {
    return group.querySelector(".check");
  });
  for (let i = 0; i <  selectedParticipants.length; i++) {
    if (selectedParticipants[i].checked) {
      let p = participantJsonParsed[i]
      let str = p.id + ",true"
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._ToggleParticipantVisibilityButton, str)
    }
  }
})

hideSelectParticipantBtn.addEventListener("click", () => {
  let selectedParticipants = mapSelectParticiapntsToInputGroups();
  for (let i = 0; i <  selectedParticipants.length; i++) {
    if (selectedParticipants[i].checked) {
      let p = participantJsonParsed[i]
      let str = p.id + ",false"
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._ToggleParticipantVisibilityButton, str)
    }
  }
})

function onEnableAutoShowOnJoin() {
  unityFetch("/enableOutputVideoByDefault?enable=true", {method: "PUT"});
}

function onDisableAutoShowOnJoin() {
  unityFetch("/enableOutputVideoByDefault?enable=false", {method: "PUT"});
}

function onShowAllLowerThirdsClick() {
  sendClickEvent(myVideoPlayer, OperatorControls._ShowAllLowerThirds);
}
function onHideAllLowerThirdsClick() {
  sendClickEvent(myVideoPlayer, OperatorControls._HideAllLowerThirds);
}
let participantInputGroupOg = document.getElementById("participant-input-group");
let participantInputGroups = [];

participantInputGroupOg.style.display = "none";

function validateParticipantInputGroups() {
  let setupGroup = function (clone){
    clone.style.display = "flex";
    setupParticipantInputGroup(clone, participantInputGroups.length - 1);
  }
  let validateGroup = function (clone, data){
    let visibilityBtn = document.querySelector(`#${clone.id} .visibility-btn`);
    let muteBtn = document.querySelector(`#${clone.id} .mute-btn`);
    let nameInput = document.querySelector(`#${clone.id} .name-input`);

    visibilityBtn.firstChild.className = data.visible ? "bi bi-eye" : "bi bi-eye-slash";
    muteBtn.firstChild.className = data.muted ? "bi bi-mic-mute" : "bi bi-mic";
    if (nameInput !== document.activeElement) {
      nameInput.value = data.username;
    }
  }
  ValidateClonesWithJsonArray(participantInputGroupOg, participantFieldset, participantInputGroups, setupGroup, participantJsonParsed, validateGroup);
}

let currentlyDraggedP

function ClearSelectParticipantsOnDrag() {
  selectAllParticipantBtn.innerHTML = selectAllParticipantBtn.innerHTML == "Select All" ? "Unselect All" : "Select All";
  let selectedParticipants = participantInputGroups.map(group => {
    return group.querySelector(".check");
  });
  for (let i = 0; i <  selectedParticipants.length; i++) {
    selectedParticipants[i].checked = false;
  }
}

function setupParticipantInputGroup(node, idx) {
  let nameInput = document.querySelector("div#" + node.id + " .name-input")
  let visibilityBtn = document.querySelector("div#" + node.id + " .visibility-btn")
  let muteBtn = document.querySelector("div#" + node.id + " .mute-btn")
  let lowerThirdBtn = document.querySelector("div#" + node.id + " .show-lower-third-btn")

  node.ondragstart = (ev) => {
    currentlyDraggedP = node;
    ClearSelectParticipantsOnDrag();
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
      let p1 = participantJsonParsed[currentIdx];
      let p2 = participantJsonParsed[droppedIdx];
      let str = p1.id + "," + p2.id;
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._SwapParticipantsButton, str)
    }
  }


  visibilityBtn.addEventListener("click", function () {
    let p = participantJsonParsed[idx]
    let str = p.id + "," + !p.visible
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._ToggleParticipantVisibilityButton, str)
  })

  muteBtn.addEventListener("click", function () {
    let p = participantJsonParsed[idx]
    let str = p.id + "," + !p.muted
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._MuteParticipantButton, str)
  })

  lowerThirdBtn.addEventListener("click", function () {
    let p = participantJsonParsed[idx];
    let str = p.id.toString();
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._ToggleParticipantLowerThird, str);
  })

  nameInput.addEventListener("change", function () {
    let str = participantJsonParsed[idx].id + "," + nameInput.value;

    sendStringSubmitEvent(myVideoPlayer, OperatorControls._SetParticipantDisplayName, str)
  })
}

/* LAYOUT CONTROL */
let layoutFieldset = document.getElementById("layout-fieldset");
let layoutDropdown = document.getElementById("layout-dropdown");
let textSizeDropdown = document.getElementById("text-size-dropdown");
let lowerThirdStyleDropdown = document.getElementById("lower-thirds-style-dropdown");
let editStyleSelect = document.getElementById("edit-style-select");

setupDropdown(layoutDropdown, onLayoutSelected)
setupDropdown(textSizeDropdown, onTextSizeSelected)
setupDropdown(lowerThirdStyleDropdown, onLowerThirdStyleSelected)
editStyleSelect.addEventListener("change", editStyleSelectionChanged)

/* LAYOUT CONTROLS IMPLEMENTATION */
function onLayoutSelected(idx) {
  sendClickEvent(myVideoPlayer, OperatorControls._SetLayoutToSimple + idx);
}

function onTextSizeSelected(idx) {
  sendStringSubmitEvent(myVideoPlayer, OperatorControls._SetSizeOfLowerThird, idx.toString());
}

function onLowerThirdStyleSelected(idx) {
  switch (idx) {
    case 0:
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._SetLowerThirdStyle1, "");
      break;
    case 1:
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._SetLowerThirdStyle2, "");
      break;
  }
}

function editStyleSelectionChanged() {
  let style = editStyleSelect.options[editStyleSelect.selectedIndex];
  let category = style.parentElement.label;
  let id = style.value;
  switch (category) {
    case "Lower Thirds":
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._GetLowerThirdStyleSchema, id);
      break;
    case "Layouts":
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._GetLayoutStyleSchema, id);
      break;
  }
}

/* LAYOUT SCHEMA EDITOR */

JSONEditor.defaults.options.disable_edit_json = true;
JSONEditor.defaults.options.disable_properties = true;
let layout_element = document.getElementById('layout-schema-editor');
let layout_editor;

function onReceiveStyleSchema(json) {

  if (layout_editor) {
    layout_editor.destroy();
  }

  let parsedJSON = JSON.parse(json);

  layout_editor = new JSONEditor(layout_element, {
    schema: parsedJSON,
    theme: 'bootstrap4',
    startval: parsedJSON.startval,
  });

  layout_editor.on('ready',() => {
    // Now the api methods will be available
    validateSchema();
  });

  layout_editor.on('change', onLayoutEditorChanged);
}

function onLayoutEditorChanged(){
  if (layoutEditorValuesSetInCB) {
    layoutEditorValuesSetInCB = false;
    return;
  }
  if (validateSchema()) {
    switch(layout_editor.options.schema.category){
      case "Lower Third":
        let str = layout_editor.options.schema.id + JSON.stringify(layout_editor.getValue());
        sendStringSubmitEvent(myVideoPlayer, OperatorControls._ChangeLowerThirdStyle, str);
        break;
      case "Layout":
        let str2 = layout_editor.options.schema.id + JSON.stringify(layout_editor.getValue());
        sendStringSubmitEvent(myVideoPlayer, OperatorControls._ChangeLayoutStyle, str2);
        break;
    }
  }
}

let layoutEditorValuesSetInCB = false;
function onReceiveStyleValues(json) {
  let data = JSON.parse(json);
  // If the schema's title matches the received data's title, then set the value.
  if (layout_editor.options.schema.title === data.title) {
    layoutEditorValuesSetInCB = true;
    layout_editor.setValue(data);
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



function onSlideTabClicked() {
  unityFetch("/getHoldingSlides")
    .then(resp => resp.json())
    .then(json => {
      validateSlideSwitchBtns(json);
    })
}

/** Scratch work on logic */
if (localStorage["currentIntroSlide"] !== "") {
  intro_preview.style.backgroundImage = `url("/slides/${localStorage["currentIntroSlide"]}")`;
}
if (localStorage["currentTechDiffSlide"] !== "") {
  techdiff_preview.style.backgroundImage = `url("/slides/${localStorage["currentTechDiffSlide"]}")`;
}
if (localStorage["currentConclusionSlide"] !== "") {
  conc_preview.style.backgroundImage = `url("/slides/${localStorage["currentConclusionSlide"]}")`;
}

function onSlideClearClicked() {
  sendClickEvent(myVideoPlayer, OperatorControls._LiveButton);
}

slideSwitchBtn.style.display = "none";

function setupSlideSetAsOptionsButton(owner) {
  let slideSetAsIntro = document.querySelector(`div#${owner.id} a[target="action-set-as-intro"]`);
  let slideSetAsTechDiff = document.querySelector(`div#${owner.id} a[target="action-set-as-techdiff"]`);
  let slideSetAsConclusion= document.querySelector(`div#${owner.id} a[target="action-set-as-conclusion"]`);

  slideSetAsIntro.addEventListener("click", (e)=>{
    intro_preview.style.backgroundImage = `url("/slides/${owner.childNodes[1].innerHTML}")`;
    localStorage.setItem("currentIntroSlide", owner.childNodes[1].innerHTML);
  });

  slideSetAsTechDiff.addEventListener("click", (e)=>{
    techdiff_preview.style.backgroundImage = `url("/slides/${owner.childNodes[1].innerHTML}")`;
    localStorage.setItem("currentTechDiffSlide", owner.childNodes[1].innerHTML);
  });

  slideSetAsConclusion.addEventListener("click", (e)=>{
    conc_preview.style.backgroundImage = `url("/slides/${owner.childNodes[1].innerHTML}")`;
    localStorage.setItem("currentConclusionSlide", owner.childNodes[1].innerHTML);
  });
}

function checkToClearPreviewOnSlideDelete(owner) {
  if (localStorage["currentIntroSlide"] === owner.childNodes[1].innerHTML) {
    intro_preview.style.backgroundImage = "";
    localStorage["currentIntroSlide"] = "";
  }
  if (localStorage["currentTechDiffSlide"] === owner.childNodes[1].innerHTML) {
    techdiff_preview.style.backgroundImage = ""
    localStorage["currentTechDiffSlide"] = "";
  }
  if (localStorage["currentConclusionSlide"] === owner.childNodes[1].innerHTML) {
    conc_preview.style.backgroundImage = ""
    localStorage["currentConclusionSlide"] = "";
  }
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
      // todo Add callback to handle response. Also make route a parameter.
      fetch(route.replace("{0}", elementWithFilename.thingToDelete), {method: "DELETE"}).then(function (response) {
        if (response.ok) {
          onDeleteConfirmed();
        }
      }).finally(function () {
        // Reset owner opacity.
        owner.style.opacity = 1;
        //Reset delete button.
        deleteBtn.innerHTML = ogDeleteContents;
      });
      checkToClearPreviewOnSlideDelete(owner);
    }
  });
}

function validateSlideSwitchBtns(slides) {
  let setupSlide = function (slide) {
    slide.style.display = "flex";
    let span = document.querySelector(`#${slide.id} span`)
    let img = document.querySelector(`#${slide.id} img`);
    setupSlideSetAsOptionsButton(slide);
    setupDeleteButton(slide, "/uapp/deleteHoldingSlide?url={0}", span, onSlideTabClicked);
    slide.addEventListener("click", function () {
      unityFetch("/setHoldingSlide?url=" + img.src, {method: "PUT"})
        .then(response => {
          if (response.ok) {
            console.log("Slide set.");
          }
        })
    });
  }
  let validateSlide = function (slide, slideInfo) {
    let img = document.querySelector(`#${slide.id} img`);
    let label = document.querySelector(`#${slide.id} span`);
    label.thingToDelete = slideInfo.url;
    label.innerHTML = slideInfo.name;
    if (slideInfo.extension === "mp4" || slideInfo.extension === "mov" || slideInfo.extension === "webm") {
      getVideoThumb(slideInfo.url, 1).then(function (blob) {
        img.src = URL.createObjectURL(blob);
      }).catch(function (err) {
        img.src = slideInfo.url;
      });
    } else {
      img.alt = img.src = slideInfo.url;
    }
  }
  ValidateClonesWithJsonArray(slideSwitchBtn, slideBtnContainer, slideSwitchBtns, setupSlide, slides, validateSlide);
}

/* Music and Video volume Level Helper */
function getVolumeLevel(value) {
  return String(Number(Math.round(parseFloat(value) * 100))) + "%"
}

/* HOLD MUSIC CONTROLS */
let holdMusicFieldset = document.getElementById("music-fieldset");
let volumeRangeMusic = document.getElementById("volume-range-music");
let volumeLevelMusic  = document.getElementById("music-volume-level");
volumeLevelMusic.innerHTML = getVolumeLevel(volumeRangeMusic.value);

volumeRangeMusic.addEventListener("input", function () {
  let str = volumeRangeMusic.value;
  volumeLevelMusic.innerHTML = getVolumeLevel(volumeRangeMusic.value);
  sendStringSubmitEvent(myVideoPlayer, OperatorControls._SetHoldingMusicVolume, str);
});
//let holdMusicClearBtn = document.getElementById("music-clear-btn");

let musicPlayStopBtn = document.getElementById("music-play-stop-btn");
musicPlayStopBtn.addEventListener("click", function () {
  if (musicPlayStopBtn.innerHTML === "Play") {
    sendClickEvent(myVideoPlayer, OperatorControls._PlayHoldingMusic);
  } else {
    sendClickEvent(myVideoPlayer, OperatorControls._StopHoldingMusic);
  }
});

let currentlyPlayingSpan = document.getElementById("currently-playing-track");

// holdMusicClearBtn.addEventListener("click", onHoldMusicClearClicked);
//
// function onHoldMusicClearClicked() {
//   sendClickEvent(myVideoPlayer, OperatorControls._StopHoldingMusic);
// }

let library = document.getElementById("library");
let trackInLibrary = document.getElementById("track-in-library");
let tracksInLibrary = [];

trackInLibrary.classList.add("d-none");

function validateTracksInLibrary(tracks) {
  let setupBtn = function (clone) {
    clone.classList.remove("d-none");
    let span = document.querySelector(`#${clone.id} span`)
    setupDeleteButton(clone, "/music_delete/{0}", span, FetchAllUploadedMediaAndUpdateDash);
    let addTrackBtn = document.querySelector(`#${clone.id} .add-track-btn`);
    addTrackBtn.addEventListener("click", function () {
      // Add to playlist
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._AddHoldingMusicToPlaylist, span.innerHTML);
    })
  }
  let validateBtn = function (btn, music) {
    let label = document.querySelector(`#${btn.id} span`);
    label.thingToDelete = label.innerHTML = music;
  }
  ValidateClonesWithJsonArray(trackInLibrary, library, tracksInLibrary, setupBtn, tracks, validateBtn)
}

let playlist = document.getElementById("playlist");
let trackInPlaylist = document.getElementById("track-in-playlist");
let tracksInPlaylist = [];

trackInPlaylist.classList.add("d-none");

function validateTracksInPlaylist(playlistData, currentlyPlayingIndex){
  let setupBtn = function (clone) {
    clone.classList.remove("d-none");
    let span = document.querySelector(`#${clone.id} span`)
    let removeTrackBtn = document.querySelector(`#${clone.id} .remove-track-btn`);
    removeTrackBtn.addEventListener("click", function () {
      let idx = tracksInPlaylist.indexOf(clone)
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
    label.innerHTML = music.trackLabel;
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
  ValidateClonesWithJsonArray(trackInPlaylist, playlist, tracksInPlaylist, setupBtn, playlistData, validateBtn)

}

/* UPLOAD CONTROLS */
let uploadDescriptor = document.getElementById("slide-upload-descriptor")
let batchSlideFileInput = document.getElementById("batch-slide-file-input")
batchSlideFileInput.addEventListener("change", batchFileInputChanged) // todo make this function less specific to slide uploads.
let batchSlideUploadBtn = document.getElementById("batch-slide-upload-btn") // todo Make this function less specific as well. Verify files based on extension.
batchSlideUploadBtn.addEventListener("click", uploadCustomSlideClicked)

/** HOLD MUSIC PREVIEW CONTROLS */
let holdMusicSelect = document.getElementById("hold-music-select")
let holdMusicOptionGroup = document.getElementById("hold-music-options-group")
holdMusicSelect.addEventListener("change", UpdateHoldMusicBrowsePreviewElement)
let holdMusicAudioPlayer = document.getElementById("hold-music-audio")

/** VIDEO BROWSE CONTROLS */
let videoSelect = document.getElementById("video-select")
let videoOptionGroup = document.getElementById("video-option-group")
videoSelect.addEventListener("change", UpdateVideoBrowsePreviewElement)
let videoPlayer = document.getElementById("video")

function UpdateEachSlidePreview(lmtRoute, element, type) {
  fetch(`${lmtRoute}/${type}`)
  .then(value => value.json())
  .then(value => {
    let lastModifiedTime;
    lastModifiedTime = value.lastUpdate
    element.style.backgroundImage = `url(/slides/${type}?${lastModifiedTime.toString()})`
  })
}

function UpdateBrowsePreviewElement(lmtRoute, element, select, srcRoute) {
  fetch(`${lmtRoute}/{element.value}`)
    .then(value => value.json())
    .then(value => {
      let lastModifiedTime;
      lastModifiedTime = value.lastUpdate
      element.src  = `${srcRoute}/${select.value}?${lastModifiedTime.toString()}`;
    })
}

function UpdateSlideBrowsePreviewElement() {
  // UpdateEachSlidePreview("/last_slide_update", intro_preview, "intro")
  // UpdateEachSlidePreview("/last_slide_update", techdiff_preview, "technicalDifficulty")
  // UpdateEachSlidePreview("/last_slide_update", conc_preview, "conclusion")
}

function UpdateHoldMusicBrowsePreviewElement() {
  UpdateBrowsePreviewElement("/last_holding_music_update", holdMusicAudioPlayer, holdMusicSelect, "/music")
}
function UpdateVideoBrowsePreviewElement() {
  UpdateBrowsePreviewElement("/last_video_update", videoPlayer, videoSelect, "/videos")
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

function FetchAllUploadedMediaAndUpdateDash() {
  // Fetch custom slides.
  unityFetch("/getHoldingSlides")
    .then(value => value.json())
    .then(slides => {
      UpdateSlideBrowsePreviewElement();
      validateSlideSwitchBtns(slides);
    })
  // Fetch holding music.
  fetch("/all_holding_music")
    .then(value => value.json())
    .then(music => {
      UpdateOptionGroupWithValues(holdMusicOptionGroup, music);
      UpdateHoldMusicBrowsePreviewElement();
      validateTracksInLibrary(music);
    })
  // Fetch videos.
  fetch("/all_videos")
    .then(value => value.json())
    .then(videos => {
      UpdateOptionGroupWithValues(videoOptionGroup, videos);
      UpdateVideoBrowsePreviewElement();
      validateVideoSwitchBtns(videos);
    })
}

// Update initially.
FetchAllUploadedMediaAndUpdateDash();

let typeToKeyWords = {
  "intro": ["intro"],
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
}

let extensionToMethod = {
  "slide" : ["png", "jpg", "jpeg"],
  "music" : ["mp3", "ogg", "wav"],
  "video" : ["mp4", "webmd"]
}

function SortFilesByExtension(files){
  let slideFiles = []
  let musicFiles = []
  let videoFiles = []
  for (let i = 0; i < files.length; i++) {
    let file = files[i]
    let extension = file.name.split(".").pop().toLowerCase()
    if (extensionToMethod["slide"].includes(extension)) {
      slideFiles.push(file)
    } else if (extensionToMethod["music"].includes(extension)) {
      musicFiles.push(file)
    } else if (extensionToMethod["video"].includes(extension)) {
      videoFiles.push(file)
    } else {
      uploadDescriptor.innerHTML += `Unknown file type: ${file.name}<br>`
    }
  }
  return [slideFiles, musicFiles, videoFiles]
}

let formInput = []
function clearFormInput() {
  formInput = []
}

function pushFormInput(nameOnServer, file, type) {
  formInput.push({
    type: type,
    name: nameOnServer,
    ogName: file.name,
    file: file
  })
}

function batchFileInputChanged(){
  clearFormInput();
  // Clear upload descriptor.
  uploadDescriptor.innerHTML = ""
  // Sort files into categories.
  let [slideFiles, musicFiles, videoFiles] = SortFilesByExtension(batchSlideFileInput.files)
  // Categorize slides by keywords upload.
  CategorizeSlideFilesByKeywordForUpload(slideFiles)
  // Simply push music and videos.
  for (let musicFile of musicFiles) {
    pushFormInput(musicFile.name, musicFile, "music")
  }
  uploadDescriptor.innerHTML  += `${musicFiles.length} music file(s),`
  for (let videoFile of videoFiles) {
    pushFormInput(videoFile.name, videoFile, "video")
  }
  uploadDescriptor.innerHTML  += ` and ${videoFiles.length} video file(s).`
  // Show edit button.
  editSlideBtn.style.display = "block";
}

function CategorizeSlideFilesByKeywordForUpload(files) {
  let accountedSlides = [];
  let customSlideCount = 0;
  for (let i = 0; i < files.length; i++) {
    let file = files[i]
    // Identify the type of slide being uploaded.
    if (!Object.keys(typeToKeyWords).some(tKey => {
      // Check if type is already accounted for.
      if (accountedSlides.includes(tKey)) return false;
      // Get keywords associated with type.
      let keywords = typeToKeyWords[tKey]
      // Search for keywords in file name.
      if (keywords.some(keyword => file.name.toLowerCase().includes(keyword))) {
        // Append to form input. Will be uploaded as found type.
        pushFormInput(tKey, file, "slide")
        uploadDescriptor.innerHTML += `'${file.name}' will be used as your ${tKey} slide.<br>`
        accountedSlides.push(tKey)
        return true;
      }
      return false; // keep looking.
    })) {
      // Type could not be identified. Will upload as custom slide.
      pushFormInput(file.name, file, "slide")
      customSlideCount++;
    }
  }
  uploadDescriptor.innerHTML += `You will be uploading ${customSlideCount} custom slide(s), `
}

function CategorizeSlideFilesBySlideTypeSelects(files) {
  let customSlideCount = 0;
  // Iterate through files from batch slide file input.
  for (let i = 0; i < files.length; i++) {
    let file = files[i]
    // Find slide type from select.
    let select = slideTypeSelects.find(select => {
      // Check if file name matches select value.
      return file.name === select.value;
    })
    if (select !== undefined) {
      // Type identified. Append to form input. Will be uploaded as found type.
      pushFormInput(select.dataset.type, file, "slide")
      uploadDescriptor.innerHTML += `'${file.name}' will be used as your ${select.dataset.type} slide.<br>`
    } else {
      // Type could not be identified. Will upload as custom slide.
      pushFormInput(file.name, file, "slide")
      customSlideCount++;
    }
  }
  uploadDescriptor.innerHTML += `You will be uploading ${customSlideCount} custom slide(s), `
}

/* EDIT SLIDE ASSIGNMENT MODAL */
let editSlideBtn = document.getElementById("edit-slide-btn")
editSlideBtn.addEventListener("click", editSlideBtnClicked)
let editSlideSaveBtn = document.getElementById("edit-slide-save-btn")
editSlideSaveBtn.addEventListener("click", editSlideSaveBtnClicked)
let introSelect = document.getElementById("intro-slide-type-select")
let techDiffSelect = document.getElementById("technical-difficulty-slide-type-select")
let conclusionSelect = document.getElementById("conclusion-slide-type-select")
let slideTypeSelects = [introSelect, techDiffSelect, conclusionSelect]

editSlideBtn.style.display = "none";
// Add event listeners to each select.
for (let select of slideTypeSelects) {
  select.addEventListener("change", function () {
    // Ensure that no two selects have the same value.
    for (let otherSelect of slideTypeSelects) {
      if (otherSelect === select) continue;
      if (otherSelect.value === select.value) {
        otherSelect.selectedIndex = 0;
      }
    }
  })
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
      option.value = formInput[i].ogName;
      option.innerText = formInput[i].ogName;
      select.appendChild(option);
      // Select option if it's name matches the slide type.
      if (formInput[i].name === select.dataset.type) {
        select.selectedIndex = i + 1;
      }
    }
  }
}

function editSlideSaveBtnClicked() {
  clearFormInput();
  // Clear descriptor
  uploadDescriptor.innerHTML = ""
  let [slideFiles, musicFiles, videoFiles] = SortFilesByExtension(batchSlideFileInput.files)
  CategorizeSlideFilesBySlideTypeSelects(slideFiles)
  // Simply push music and videos.
  for (let musicFile of musicFiles) {
    pushFormInput(musicFile.name, musicFile, "music")
  }
  uploadDescriptor.innerHTML += `${musicFiles.length} music file(s), `
  for (let videoFile of videoFiles) {
    pushFormInput(videoFile.name, videoFile, "video")
  }
  uploadDescriptor.innerHTML += ` and ${videoFiles.length} video file(s).`
}

function uploadCustomSlideClicked() {
  // Hide edit button.
  editSlideBtn.style.display = "none";
  let parentTracker = document.getElementById("uploadTrackerContainer");
  batchSlideUploadBtn.disabled = true;

  let upload = function (input) {
    return new Promise(function(resolve, reject) {
      let formData = new FormData()
      formData.append("type", input.type)
      formData.append(input.name, input.file)

      let request = new XMLHttpRequest();
      createUploadProgressTracker(parentTracker, request, input.name);
      request.onload = function() {
        if (request.status >= 200 && request.status < 300) {
          resolve(request.response);
        } else {
          reject(request.statusText);
        }};
      request.open("POST", "/slide_upload");
      request.send(formData);
    })
  }

  let uploads = formInput.map((file) => { return upload(file) });

  // After all files are done uploading re-enable upload button.
  Promise.all(uploads).then(() => {
    batchSlideUploadBtn.disabled = false;
    FetchAllUploadedMediaAndUpdateDash();
  })

}



/* VIDEO CONTROLS */
let videoFieldsetBar  = document.getElementById("video-fieldset-bar");
let videoPlayPauseBtn = document.getElementById("video-play-stop-btn");
let videoBtnContainer = document.getElementById("video-btn-container");
let videoSwitchBtn = document.getElementById("video-btn-element");
let videoSwitchBtns = [];
let videoClearBtn = document.getElementById("video-clear-btn");
let videoProgress = document.getElementById("video-progress");
let videoPlaybackTime = document.getElementById("video-playback-time");
let videoVolume  = document.getElementById("volume-range-video");
let videoVolumeLevel  = document.getElementById("video-volume-level");
videoVolumeLevel.innerHTML = getVolumeLevel(videoVolume.value);
videoClearBtn.addEventListener("click", onVideoClearClicked);

videoVolume.addEventListener("input", function() {
  let str = videoVolume.value;
  videoVolumeLevel.innerHTML = getVolumeLevel(videoVolume.value);
  sendStringSubmitEvent(myVideoPlayer, OperatorControls._VolumeVideo, str);
});

videoProgress.addEventListener("change", function () {
  let str = videoProgress.value;
  videoPlaybackTime.innerHTML = videoProgress.value;
  clearInterval(videoTimerIntervalId);
  videoTimerIntervalId = 0;
  sendStringSubmitEvent(myVideoPlayer, OperatorControls._SeekVideoButton, str);
});

videoPlayPauseBtn.addEventListener("click", function() {
  if (videoPlayPauseBtn.innerHTML === '<i class="bi bi-play"></i>') {
    sendClickEvent(myVideoPlayer, OperatorControls._PlayVideo);
  } else {
    sendClickEvent(myVideoPlayer, OperatorControls._PauseVideo);
  }
});

function onVideoClearClicked() {
  sendClickEvent(myVideoPlayer, OperatorControls._LiveButton);
}

videoSwitchBtn.style.display = "none";

function validateVideoSwitchBtns(videos) {
  // Be sure there are enough buttons for videos.
  if (videoSwitchBtns.length < videos.length) {
    while (videoSwitchBtns.length < videos.length) {
      // Elements must be added.
      let clone = videoSwitchBtn.cloneNode(true);
      clone.id += "-" + videoSwitchBtns.length;
      clone.style.display = "flex"
      videoBtnContainer.appendChild(clone);
      videoSwitchBtns.push(clone);
      let span = document.querySelector(`#${clone.id} span`)
      setupDeleteButton(clone, "/video_delete/{0}", span, FetchAllUploadedMediaAndUpdateDash);
      let button1 = document.querySelector(`#${clone.id} .media-left-btn`);
      let button2 = document.querySelector(`#${clone.id} .media-right-btn`);
      button1.addEventListener("click", function () {
        let str = `${span.innerHTML},false`
        sendStringSubmitEvent(myVideoPlayer, OperatorControls._ShowVideoButton, str);
      })
      button2.addEventListener("click", function () {
        let str = `${span.innerHTML},true`
        sendStringSubmitEvent(myVideoPlayer, OperatorControls._ShowVideoButton, str);
      })

    }
  } else {
    while (videoSwitchBtns.length > videos.length) {
      // Elements must be destroyed.
      videoSwitchBtns.pop().remove();
    }
  }
  // Set data of each button.
  for (let i = 0; i < videos.length; i += 1) {
    let btn = videoSwitchBtns[i];
    let img = document.querySelector(`#${btn.id} img`);
    let label = document.querySelector(`#${btn.id} span`);
    label.thingToDelete = label.innerHTML = videos[i];
    getVideoThumb("/videos/" + label.innerHTML, 1).then(function (blob) {
      img.src = URL.createObjectURL(blob);
    }).catch(function (err) {
      console.error(err);
    });
  }
}

/* LOGS DOWNLOAD */

let logDownloadBtn = document.getElementById("log-download-btn");
let listLogFileOptions = document.getElementById("list-all-log-files");
let errorAlertLogFile = document.getElementById("error-alert-log-file");

logDownloadBtn.addEventListener("click", onLogDownloadClicked)
listLogFileOptions.addEventListener("click", listAvailableLogs);

function onLogDownloadClicked() {
  if (listLogFileOptions.value === "none") {
    alertDisplay(errorAlertLogFile);
  } else {
    downloadLog();
  }
}

function downloadLog() {
  let fname = listLogFileOptions.value;
  let client = new XMLHttpRequest()
  client.open("GET", "/download_log/" + fname)
  client.responseType = "blob";
  client.send()

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
    logDownloadBtn.innerHTML = "Downloaded!"
    setTimeout(() => {
      logDownloadBtn.innerHTML = "Download Log"
      logDownloadBtn.disabled = false; // re-enable download button
    }, 1000)
  }

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

/* RECORDING CONTROLS */
let listFileOptions = document.getElementById("list-all-files")
listFileOptions.addEventListener("click", listAvailableRecordings);

let recordingDownloadBtn = document.getElementById("recording-download")
recordingDownloadBtn.addEventListener("click", handleRecordingDownload)

let progressField = document.getElementById("progress-field");
let progress = document.getElementById("progress");
let progressText = document.getElementById("progress-text");
let remainingText = document.getElementById("remaining-text");

function downloadFile() {

  // init and make a request.
  let fname = listFileOptions.value;
  let client = new XMLHttpRequest()
  client.open("GET", "/download/" + fname)
  client.responseType = "blob";
  client.send()

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
      progress.max = e.total
      progress.value = e.loaded

      let percent = (e.loaded / e.total) * 100;
      percent = Math.floor(percent);
      progressText.innerHTML = percent + "%";

      let end = new Date().getTime();
      let duration = (end - start) / 1000;
      let bps = e.loaded / duration;
      let kbps = Math.floor(bps / 1024);

      let time = (e.total - e.loaded) / bps;
      let min = Math.floor(time / 60)
      let sec = Math.floor(time % 60)
      remainingText.innerHTML = kbps + " KB/s. remaining time: " + min + " minute(s) " + sec + " second(s).";
    }
  }
  // when download is complete.
  client.onloadend = function (e) {
    progress.value = e.loaded
    remainingText.innerHTML = "Done!"

    setTimeout(() => {
      recordingDownloadBtn.disabled = false; // re-enable download button
      progressField.classList.add("d-none");// hide the download progress
      // reset
      progress.value = "0";
      progress.max = "1";
      remainingText.innerHTML = "";
      progressText.innerHTML = "";
      listFileOptions.value = "none";
    }, 2000)
  }
}

async function listAvailableRecordings() {
  await updateStreamPref();
  let resp = await fetch("/listRecordings/" + streamKey.value);
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
    option.value = files[i];
    option.innerText = files[i];
  }
}

function handleRecordingDownload() {

  if (listFileOptions.value === "none") {
    alertDisplay(errorAlertFile);
  } else {
    downloadFile();
  }
}

/* BRING NAV-TABS INTO VIEW*/
let navZoomTabBtn = document.getElementById("nav-zoom-tab");
navZoomTabBtn.addEventListener("click", ()=>{navZoomTabBtn.scrollIntoView();});

let navPartTabBtn = document.getElementById("nav-participants-tab");
navPartTabBtn.addEventListener("click", ()=>{navPartTabBtn.scrollIntoView();});

let navLayoutTabBtn = document.getElementById("nav-layout-tab");
navLayoutTabBtn.addEventListener("click", ()=>{navLayoutTabBtn.scrollIntoView();});

let navSlideTabBtn = document.getElementById("nav-slide-tab");
navSlideTabBtn.addEventListener("click", ()=>{onSlideTabClicked(); navSlideTabBtn.scrollIntoView();});

let navMusicTabBtn = document.getElementById("nav-music-tab");
navMusicTabBtn.addEventListener("click", ()=>{navSlideTabBtn.scrollIntoView();});

let navVideoTabBtn = document.getElementById("nav-video-tab");
navVideoTabBtn.addEventListener("click", ()=>{navVideoTabBtn.scrollIntoView();});

let navLogTabBtn = document.getElementById("nav-log-tab");
navLogTabBtn.addEventListener("click", ()=>{navLogTabBtn.scrollIntoView(); fetchLogs();});

let navUploadTabBtn = document.getElementById("nav-upload-tab");
navUploadTabBtn.addEventListener("click", ()=>{navUploadTabBtn.scrollIntoView();});

let navRecordingTabBtn = document.getElementById("nav-recording-tab");
navRecordingTabBtn.addEventListener("click", ()=>{navRecordingTabBtn.scrollIntoView();});