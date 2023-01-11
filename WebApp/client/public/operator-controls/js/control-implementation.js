/*
This file contains the implementations of our controls, including zoom controls, participant management, stream settings
 and logging.
 */
import { OperatorControls } from "/operator-controls/js/control-map.gen.js";
import { sendClickEvent, sendStringSubmitEvent } from "/videoplayer/js/register-events.js";
import { myVideoPlayer, mainNotifications } from "/operator-controls/js/control-main.js";
import { ValidateClonesWithJsonArray} from "/operator-controls/js/validation-helper.js";


mainNotifications.addEventListener('setup', function () {
  myVideoPlayer.onParticipantDataReceived = participantDataReceived;
  myVideoPlayer.onAppStatusReceived = appStatusReceived;
  myVideoPlayer.onChatHistoryReceived = validateChatHistory;
  myVideoPlayer.onStyleSchemaReceived = onReceiveStyleSchema; // todo set this to function that generates json editor.
  setTimeout(() => {
    sendClickEvent(myVideoPlayer, OperatorControls._GetParticipantData);
    sendClickEvent(myVideoPlayer, OperatorControls._GetAppStatus);
  }, 1000);
  setTimeout(() => {
    sendClickEvent(myVideoPlayer, OperatorControls._GetChatHistory);
  }, 1000);
});

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
  let muteEl = document.querySelector(`div#${node.id} .participant-on-vid-mute`);
  let renameEl = document.querySelector(`div#${node.id} a[target="action-rename"]`);
  let showLtEl = document.querySelector(`div#${node.id} a[target="action-show-lt"]`);
  let showLtExclusiveEl = document.querySelector(`div#${node.id} a[target="action-show-lt-exclusive"]`);
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

  eyeEl.addEventListener("click", function () {
    let p = participantJsonParsed[idx];
    let str = p.id + "," + !p.visible;
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._ToggleParticipantVisibilityButton, str);
  })

  muteEl.addEventListener("click", function () {
    let p = participantJsonParsed[idx];
    let str = p.id + "," + !p.muted;
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._MuteParticipantButton, str);
  })

  renameEl.addEventListener("click", function() {
    let p = participantJsonParsed[idx];
    participantName.value = p.username;
    participantToRename = idx;
  })

  showLtEl.addEventListener("click", function(ev) {
    ev.preventDefault();
    let p = participantJsonParsed[idx];
    let str = `${p.id},${!p.lowerThirdShowing}`;
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._ShowLowerThird, str);
  })

  showLtExclusiveEl.addEventListener("click", function(ev) {
    ev.preventDefault();
    let p = participantJsonParsed[idx];
    let str = `${p.id}`;
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._JustShowSpecificParticipantLowerThird, str);
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
  let resp = await fetch("/getStreamPref");
  let data = await resp.json();
  if (!resp.ok) {
    console.error("Error " + resp.status + ": " + data.message)
    errorMsg.innerHTML = data.message;
    alertDisplay(errorAlert);
  } else {
    let reg = new RegExp("[:/.]");
    let url = data.settings.server.split(reg);
    streamingServerAdd.value = url[3];
    streamingApp.value = url[6];
    streamKey.value = data.settings.key;
    uname.value = data.settings.username;
    pwd.value = data.settings.password;
    streamUrl.innerHTML = data.settings.server;
    boardData.innerHTML = data.settings.server + data.settings.key;
  }

}

async function saveStreamPref() {
  saveBtn.disabled = true;
  let resp = await fetch("/stream_pref?" +
    "streamingServerAdd=" + streamingServerAdd.value +
    "&streamingApp=" + streamingApp.value +
    "&streamKey=" + streamKey.value +
    "&uname=" + uname.value +
    "&pwd=" + pwd.value)
  let data = await resp.json()
  if (!resp.ok) {
    console.error("Error " + resp.status + ": " + data.message)
    errorMsg.innerHTML = data.message;
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


  if (jsonParsed.inMeeting || jsonParsed.meetingSimulated) {
    validateTracksInPlaylist(jsonParsed.playlist, jsonParsed.currentlyPlayingIndex)
    meetingNoInputField.disabled = true;
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
      } else if (jsonParsed.holdingSlide === "none") {
        ActivateButtonHelper(liveBtn, true)
      } else if (jsonParsed.holdingSlide === "endOfStream") {
        ActivateButtonHelper(archiveBtn, true)
      }
    } else {
      pendingBtn.innerHTML = "Start stream"
      viewModal.disabled = false;
    }

    if (jsonParsed.secondClickEndsStream) {
      archiveBtn.innerHTML = "End Stream"
    } else {
      archiveBtn.innerHTML = "Archive"
    }
  } else {
    meetingNoInputField.disabled = false;
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


/* HOLDING SLIDE BUTTONS */
let pendingBtn = document.getElementById("pending-btn");
pendingBtn.addEventListener("click", onPendingClick);
let liveBtn = document.getElementById("live-btn");
liveBtn.addEventListener("click", onLiveClick);
let technicalDiffBtn = document.getElementById("technical-diff-btn")
technicalDiffBtn.addEventListener("click", onTechnicalDiff);
let archiveBtn = document.getElementById("archive-btn")
archiveBtn.addEventListener("click", onArchiveClick);

/* HOLDING SLIDE BUTTON IMPLEMENTATION */
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
let joinMeetingBtn = document.getElementById("join-meeting-btn")
joinMeetingBtn.addEventListener('click', onJoinClick)
let leaveMeetingBtn = document.getElementById("leave-meeting-btn")
leaveMeetingBtn.addEventListener("click", onLeaveClicked)

/* ZOOM CONTROL IMPLEMENTATION */
function onJoinClick() {
  sendStringSubmitEvent(myVideoPlayer, OperatorControls._JoinMeetingButton, meetingNumberInput.value);
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
function onShowAllLowerThirdsClick() {
  sendClickEvent(myVideoPlayer, OperatorControls._ShowAllLowerThirds)
}
function onHideAllLowerThirdsClick() {
  sendClickEvent(myVideoPlayer, OperatorControls._HideAllLowerThirds)
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

function setupParticipantInputGroup(node, idx) {
  let nameInput = document.querySelector("div#" + node.id + " .name-input")
  let visibilityBtn = document.querySelector("div#" + node.id + " .visibility-btn")
  let muteBtn = document.querySelector("div#" + node.id + " .mute-btn")
  let lowerThirdBtn = document.querySelector("div#" + node.id + " .show-lower-third-btn")
  let exclusiveLowerThirdBtn = document.querySelector("div#" + node.id + " .show-lower-third-exclusive-btn")

  node.ondragstart = (ev) => {
    currentlyDraggedP = node;
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
    let p = participantJsonParsed[idx]
    let str = p.id + "," + !p.lowerThirdShowing
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._ShowLowerThird, str)
  })

  exclusiveLowerThirdBtn.addEventListener("click", function () {
    let p = participantJsonParsed[idx]
    let str = p.id.toString();
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._JustShowSpecificParticipantLowerThird, str)
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
    // Note: empty str values will eventually be replaced with arguments for style.
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

  layout_editor.on('change',() => {
    // TODO : create a new method to run operations upon change
    if (validateSchema()){
      switch(layout_editor.options.schema.category){
        case "Lower Third":
          let str = layout_editor.options.schema.id + JSON.stringify(layout_editor.getValue());
          sendStringSubmitEvent(myVideoPlayer, OperatorControls._ChangeLowerThirdStyle, str);
      }
    }
  });
}

function validateSchema() {

  const err = layout_editor.validate();

  if (err.length) {
    console.log(err); //if the schema is invalid
    return false;
  }
  return true;
}



/* DELETE BUTTON */
function setupDeleteButton(owner, route, spanWithFilename) {
  let deleteBtn = document.querySelector(`#${owner.id} .media-delete-btn`);
  let ogDeleteContents = deleteBtn.innerHTML;
  let confirmDeleteContents = `Confirm delete?`;
  deleteBtn.addEventListener("click", function () {
    if (deleteBtn.innerHTML !== confirmDeleteContents) {
      // Confirm deletion.
      deleteBtn.innerHTML = confirmDeleteContents;
      setTimeout(function () {
        deleteBtn.innerHTML = ogDeleteContents;
      }, 2000);
    } else {
      // Reset button.
      deleteBtn.innerHTML = ogDeleteContents;
      // Delete media.
      fetch(`${route}/${spanWithFilename.innerHTML}`, {method: "DELETE"}).then(function (response) {
        if (response.ok) {
          UpdateUploadBrowseOptionGroupElements();
        }
      });
    }
  });
}

/* SLIDE CONTROLS */
let slideFieldset = document.getElementById("slide-fieldset");
let slideBtnContainer = document.getElementById("slide-btn-container");
let slideSwitchBtn = document.getElementById("slide-btn-element");
let slideSwitchBtns = [];
let slideClearBtn = document.getElementById("slide-clear-btn");
slideClearBtn.addEventListener("click", onSlideClearClicked);

function onSlideClearClicked() {
  sendClickEvent(myVideoPlayer, OperatorControls._LiveButton);
}

slideSwitchBtn.style.display = "none";

function validateSlideSwitchBtns(slides) {
  // Be sure there are enough buttons for slides.
  if (slideSwitchBtns.length < slides.length) {
    while (slideSwitchBtns.length < slides.length) {
      // Elements must be added.
      let clone = slideSwitchBtn.cloneNode(true);
      clone.id += "-" + slideSwitchBtns.length;
      clone.style.display = "flex"
      slideBtnContainer.appendChild(clone);
      slideSwitchBtns.push(clone);
      let span = document.querySelector(`#${clone.id} span`)
      //let deleteBtn = document.querySelector(`#${clone.id} .media-delete-btn`); // todo: make a function to create delete buttons.
      setupDeleteButton(clone, "/slide_delete", span);
      let button1 = document.querySelector(`#${clone.id} .media-left-btn`);
      let button2 = document.querySelector(`#${clone.id} .media-right-btn`);
      button1.addEventListener("click", function () {
        let str = `${span.innerHTML},false`
        sendStringSubmitEvent(myVideoPlayer, OperatorControls._CustomSlideButton, str);
      })
      button2.addEventListener("click", function () {
        let str = `${span.innerHTML},true`
        sendStringSubmitEvent(myVideoPlayer, OperatorControls._CustomSlideButton, str);
      })
    }
  } else {
    while (slideSwitchBtns.length > slides.length) {
      // Elements must be destroyed.
      slideSwitchBtns.pop().remove();
    }
  }
  // Set data of each button.
  for (let i = 0; i < slides.length; i += 1) {
    let btn = slideSwitchBtns[i];
    let img = document.querySelector(`#${btn.id} img`);
    let label = document.querySelector(`#${btn.id} span`);
    label.innerHTML = slides[i];
    img.alt = img.src = `/slides/${slides[i]}`;
  }
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
    setupDeleteButton(clone, "/music_delete", span);
    let addTrackBtn = document.querySelector(`#${clone.id} .add-track-btn`);
    addTrackBtn.addEventListener("click", function () {
      // Add to playlist
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._AddHoldingMusicToPlaylist, span.innerHTML);
    })
  }
  let validateBtn = function (btn, music) {
    let label = document.querySelector(`#${btn.id} span`);
    label.innerHTML = music;
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

/** SLIDE BROWSE CONTROLS */
let slideSelect = document.getElementById("slide-select")
let customSlideOptionGroup = document.getElementById("custom-slide-option-group")
slideSelect.addEventListener("change", UpdateSlideBrowsePreviewElement)
let slideImg = document.getElementById("slide-img")

/** HOLD MUSIC BROWSE CONTROLS */
let holdMusicSelect = document.getElementById("hold-music-select")
let holdMusicOptionGroup = document.getElementById("hold-music-options-group")
holdMusicSelect.addEventListener("change", UpdateHoldMusicBrowsePreviewElement)
let holdMusicAudioPlayer = document.getElementById("hold-music-audio")

/** VIDEO BROWSE CONTROLS */
let videoSelect = document.getElementById("video-select")
let videoOptionGroup = document.getElementById("video-option-group")
videoSelect.addEventListener("change", UpdateVideoBrowsePreviewElement)
let videoPlayer = document.getElementById("video")

function UpdateBrowsePreviewElement(lmtRoute, element, select, srcRoute) {
  fetch(`${lmtRoute}/{element.value}`)
    .then(value => value.json())
    .then(value => {
      let lastModifiedTime;
      lastModifiedTime = value.lastUpdate
      element.src = `${srcRoute}/${select.value}?${lastModifiedTime.toString()}`
    })
}

function UpdateSlideBrowsePreviewElement() {
  UpdateBrowsePreviewElement("/last_slide_update", slideImg, slideSelect, "/slides")
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

function UpdateUploadBrowseOptionGroupElements() {
  // Fetch custom slides.
  fetch("/all_custom_slides")
    .then(value => value.json())
    .then(slides => {
      UpdateOptionGroupWithValues(customSlideOptionGroup, slides);
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
UpdateUploadBrowseOptionGroupElements();

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
    let extension = file.name.split(".").pop()
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
  uploadDescriptor.innerHTML  += `${musicFiles.length} music files, <br>`
  for (let videoFile of videoFiles) {
    pushFormInput(videoFile.name, videoFile, "video")
  }
  uploadDescriptor.innerHTML  += `and ${videoFiles.length} video files. <br>`
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
      pushFormInput(file.name, file, "custom_slide")
      customSlideCount++;
    }
  }
  uploadDescriptor.innerHTML += `You will be uploading ${customSlideCount} custom slides.<br>`
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
      pushFormInput(file.name, file, "custom_slide")
      customSlideCount++;
    }
  }
  uploadDescriptor.innerHTML += `You will be uploading ${customSlideCount} custom slides.<br>`
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
      if (formInput[i].type !== "slide" && formInput[i].type !== "custom_slide") continue;
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
  uploadDescriptor.innerHTML += `${musicFiles.length} music files, `
  for (let videoFile of videoFiles) {
    pushFormInput(videoFile.name, videoFile, "video")
  }
  uploadDescriptor.innerHTML += `and ${videoFiles.length} video files.`
}

function uploadCustomSlideClicked() {
  // Hide edit button.
  editSlideBtn.style.display = "none";
  for (let input of formInput) {
    let formData = new FormData()
    formData.append("type", input.type)
    formData.append(input.name, input.file)
    fetch("/slide_upload", {
      method: "POST",
      body: formData
    }).then(HandleSlideUploadResponse)
  }
  uploadDescriptor.innerHTML = "Uploading..."
}

async function HandleSlideUploadResponse(resp) {
  let data = await resp.json();
  // Update slide preview.
  for (let message of data.messages) {
    uploadDescriptor.innerHTML += `<br>${message}`
  }
  UpdateSlideBrowsePreviewElement();
  UpdateHoldMusicBrowsePreviewElement();
  UpdateVideoBrowsePreviewElement();
  UpdateUploadBrowseOptionGroupElements();
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

function getVideoImage(path, secs, callback, img) {
  var me = this, video = document.createElement('video');
  video.onloadedmetadata = function() {
    if ('function' === typeof secs) {
      secs = secs(this.duration);
    }
    this.currentTime = Math.min(Math.max(0, (secs < 0 ? this.duration : 0) + secs), this.duration);
  };
  video.onseeked = function(e) {
    var canvas = document.createElement('canvas');
    canvas.height = video.videoHeight;
    canvas.width = video.videoWidth;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    img.src = canvas.toDataURL();
    callback.call(me, img, this.currentTime, e);
  };
  video.onerror = function(e) {
    callback.call(me, undefined, undefined, e);
  };
  video.src = path;
}

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
      //let deleteBtn = document.querySelector(`#${clone.id} .media-delete-btn`); // todo: make a function to create delete buttons.
      setupDeleteButton(clone, "/video_delete", span);
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
    label.innerHTML = videos[i];
    getVideoImage("/videos/" + label.innerHTML, 1, function(img, secs, event) {}, img);
  }
}

/* CHAT CONTROLS */
let chatHistory = document.querySelector("div.chat-history ul");
let cHistory = document.getElementById("cHistory")
let chatMessage = document.getElementById("chat-clone-source");
let chatMessages = [];

let sendMessageInput = document.getElementById("send-message-input");
let sendMessageBtn = document.getElementById("send-message-btn");
sendMessageBtn.disabled = true;
sendMessageInput.addEventListener("input", function() {
  sendMessageBtn.disabled = (sendMessageInput.value === "") ? true : false;
});

sendMessageInput.addEventListener("keypress", function(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessageBtn.click();
  }
});
sendMessageBtn.addEventListener("click", function() {
  let str = sendMessageInput.value;
  sendStringSubmitEvent(myVideoPlayer, OperatorControls._MessageReceived, str);
  scrollToBottom(cHistory);

  // Take this opportunity to clear the input.
  sendMessageInput.value = "";
  sendMessageBtn.disabled = true;

});

let navChatTab = document.getElementById("nav-chat-tab");
navChatTab.addEventListener("click", function() {
  // Get the chat history.
  sendClickEvent(myVideoPlayer, OperatorControls._GetChatHistory);
  // Set utc offset.
  let date = new Date();
  // NOTE: This is inverted because Unity app will use offset to go from UTC-0 to client's local time.
  let utcOffset = -date.getTimezoneOffset();
  sendStringSubmitEvent(myVideoPlayer, OperatorControls._SetUtcOffset, String(utcOffset));
});

function scrollToBottom(obj) {
  obj.scrollTop = obj.scrollHeight;
};

function validateChatHistory(history){
  let setupChatMessage = function (clone) {
    clone.classList.remove("d-none");
  }
  let validateChatMessage = function (clone, message) {
    let messageText = document.querySelector(`#${clone.id} .message`);
    let messageDataTime = document.querySelector(`#${clone.id} div.message-data .message-data-time`);
    messageDataTime.innerText = `${message.name} - ${message.time}`;
    messageText.innerText = message.message;
    if (myVideoPlayer.connectionId === message.sender){
      let messageData = document.querySelector(`#${clone.id} div.message-data`);
      messageData.classList.remove("text-right");
      messageText.classList.remove("float-right");
      messageText.classList.remove("other-message");
      messageText.classList.add("my-message");
    }
  }
  let jsonHistory = JSON.parse(history);
  ValidateClonesWithJsonArray(chatMessage, chatHistory, chatMessages, setupChatMessage, jsonHistory, validateChatMessage);
  scrollToBottom(cHistory);
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
