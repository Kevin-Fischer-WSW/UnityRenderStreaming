/*
This file contains the implementations of our controls, including zoom controls, participant management, stream settings
 and logging.
 */
import { OperatorControls } from "/operator-controls/js/control-map.gen.js";
import { sendClickEvent, sendStringSubmitEvent } from "/videoplayer/js/register-events.js";
import { myVideoPlayer, mainNotifications } from "/operator-controls/js/control-main.js";
import { ValidateClonesWithJsonArray } from "/operator-controls/js/validation-helper.js";
import * as Style from "/operator-controls/js/style-helper.js";
import { unityFetch, unityPutJson } from "../../js/unity-fetch.js";
import { getVideoThumb } from "../../js/video-thumbnail.js";
import { createUploadProgressTracker } from "../../js/progresstracker.js";
import { CropWidget } from "../../js/crop-widget.js";
import * as Feedback from "../../js/user-input-feedback-alert.js";
import { onEnableAdvancedSettings } from "./advancedSettings.js";

Feedback.setDefaultParentElement(document.getElementById("alert-container"));

mainNotifications.addEventListener('setup', function () {
  myVideoPlayer.onParticipantDataReceived = participantDataReceived;
  myVideoPlayer.onAppStatusReceived = appStatusReceived;
  myVideoPlayer.onStyleValuesReceived = onReceiveStyleValues;
  myVideoPlayer.onLogMessageNotification = onLogMessageNotification;
  myVideoPlayer.onNewMediaNotification = onNewMediaNotification;
  myVideoPlayer.onMusicPlaybackTimeReceived = onMusicPlaybackTimeReceived;
  myVideoPlayer.onVideoPlaybackTimeReceived = onVideoPlaybackTimeReceived;
  myVideoPlayer.onWrongPasswordNotification = onWrongPasswordNotification;
  myVideoPlayer.onRegistrationUrlReceived = onRegistrationUrlReceived;
});

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

  setTimeout(function () {
    extend();
  }, 700)
});

async function extend() {
  let resp = await fetch("/extend");
  let data = await resp.json();
  if (!data.valid) {
    alert("Your session has expired! You're being redirected...");
    window.location = window.location.origin;
  }
}

/* PARTICIPANT ACTIONS ON VIDEO ELEMENT */
// => DOM ELEMENTS
let participantOnVidCtrlOg = document.getElementById("participant-on-vid-ctrl-og");
let previewVideoContainer = document.getElementById("preview-video-container");

// => PRIMITIVE AND OTHER TYPES
let participantOnVidCtrls = [];

// => METHODS
function setupParticipantOnVidCtrl(node, idx) {
  let dragEl = document.querySelector(`div#${node.id} .participant-on-vid-drag`);
  let eyeEl = document.querySelector(`div#${node.id} .participant-on-vid-eye`);
  let earEl = document.querySelector(`div#${node.id} .participant-on-vid-ear`);
  let renameEl = document.querySelector(`div#${node.id} a[target="action-rename"]`);
  let showLtEl = document.querySelector(`div#${node.id} a[target="action-show-lt"]`);

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
      let p1 = participantJsonParsed[currentIdx];
      let p2 = participantJsonParsed[droppedIdx];
      let str = p1.id + "," + p2.id;
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._SwapParticipantsButton, str);
    }
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
}

function validateParticipantOnVidCtrls() {
  let setupCtrl = function (clone) {
    setupParticipantOnVidCtrl(clone, participantOnVidCtrls.length - 1);
  }
  let validateCtrl = function (ctrl, data) {
    ctrl.style.top = (100 * data.top) + "%";
    ctrl.style.left = (100 * data.left) + "%";
    ctrl.style.width = (100 * data.width) + "%";
  }
  ValidateClonesWithJsonArray(participantOnVidCtrlOg, previewVideoContainer, participantOnVidCtrls, setupCtrl, participantJsonParsed, validateCtrl);
}

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
let serverAddressSelect = document.getElementById('serverAddressSelect');
let streamKey = document.getElementById("stream-key-input");
let streamAuthSettings = document.getElementById("stream-auth-settings");
let streamPrefModal = document.getElementById("stream-pref-modal");
let streamPrefAlerts = document.getElementById("stream-pref-alerts");
let streamSettingsFieldset = document.getElementById("stream-settings-fieldset");
let streamingApp = document.getElementById("serverAppSelect");
let streamingServerAdd = document.getElementById("serverAddressSelect");
let uname = document.getElementById("username-input");

let saveBtn = document.getElementById("save-btn");
let streamSettingsBtn = document.getElementById("stream-settings");

// => PRIMITIVE AND OTHER TYPES
var clipboard = new ClipboardJS(copyBtn, {
  container: streamPrefModal,
  copyData: copyData,
  text: function () {
    return copyData.innerHTML;
  }
});

// => METHODS
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

async function saveStreamPref() {
  saveBtn.disabled = true;
  let resp = await unityFetch("/setStreamServiceSettings?" +
    "serverUrl=" + `rtmp://${streamingServerAdd.value}.wsw.com/${streamingApp.value}/` +
    "&streamKey=" + streamKey.value +
    "&username=" + uname.value +
    "&password=" + pwd.value,
    { method: "PUT" });
  if (!resp.ok) {
    Feedback.alertDanger(resp.statusText, streamPrefAlerts);
  } else {
    await updateStreamPref();
    Feedback.alertSuccess("Stream settings saved successfully!", streamPrefAlerts);
  }
}

async function updateStreamPref() {
  let resp = await unityFetch("/getStreamServiceSettings");
  let data = await resp.json();
  if (!resp.ok) {
    Feedback.alertDanger("Could not get stream service settings.", streamPrefAlerts);
  } else {
    let reg = new RegExp("[:/.]");
    let url = data.streamServiceSettings.server.split(reg);
    streamingServerAdd.value = url[3];
    streamingApp.value = url[6];
    streamKey.value = data.streamServiceSettings.key;
    uname.value = data.streamServiceSettings.username;
    pwd.value = data.streamServiceSettings.password;
    boardData.innerHTML = url[3] === "none" ? "" : data.streamServiceSettings.server + data.streamServiceSettings.key;
  }
}

// => EVENT LISTENERS
pwd.addEventListener("input", flagStreamPrefChange);
saveBtn.addEventListener("click", saveStreamPref);
streamingApp.addEventListener("input", flagStreamPrefChange);
streamKey.addEventListener("input", flagStreamPrefChange);
streamingServerAdd.addEventListener("input", flagStreamPrefChange);
streamSettingsBtn.addEventListener("click", updateStreamPref);
uname.addEventListener("input", flagStreamPrefChange);

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
  saveBtn.disabled = true;
  serverAddressSelect.focus();
})

/* GENERAL STATUS BAR */
// => DOM ELEMENTS
let generalStatBar = document.getElementById("general-status-bar");

/* STREAM ACTIVITY BAR */
// => DOM ELEMENTS
let onAirText = document.getElementById("on-air-text");
let onAirIndicator = document.getElementById("on-air-indicator-icon");
let onAirInfoText = document.getElementById("on-air-info-text");
let streamActivityBar = document.getElementById("stream-activity-bar");

// => METHODS
function resetStreamActivityBarInfo() {
  /* reset aesthetics to default */
  onAirText.style.color = onAirIndicator.style.color = onAirInfoText.style.color = "grey";
  streamActivityBar.style.backgroundColor = "#4c4c4c";
  onAirInfoText.innerHTML = `Audio: None <br> Video: None <br> Recording: Inactive`;
}

function updatestreamActivityBarInfo(appStatus) {
  /* update aesthetics */
  streamActivityBar.style.backgroundColor = "#2ecc71";
  onAirText.style.color = onAirIndicator.style.color = "red";
  onAirInfoText.style.color = "black";

  let videoInfo = "None";
  let audioInfo = [];

  /* check audio sources */
  if (appStatus.isAnyParticipantAudible) audioInfo.push("Presenter");
  if (appStatus.playingHoldingMusic && appStatus.holdingMusicVolume) audioInfo.push("Holding music");
  if (appStatus.playingVideo && appStatus.currentVideoVolume) audioInfo.push("Video playback audio");

  /* check video sources */
  if (appStatus.holdingSlide) videoInfo = appStatus.holdingSlide.charAt(0).toUpperCase() + appStatus.holdingSlide.slice(1);
  if (appStatus.videoIsShowing && appStatus.holdingSlide) videoInfo = "Video playback";
  if (appStatus.isAnyParticipantVisible && !appStatus.videoIsShowing && appStatus.holdingSlide === "none") videoInfo = "Presenter";

  /* update information */
  onAirInfoText.innerHTML = `Audio: ${audioInfo.length > 0 ? audioInfo.join(", ") : "None"}
    <br> Video: ${videoInfo}
    <br> Recording: ${appStatus.recording ? "Active" : "Inactive"}`;
}

/* STREAM BUTTONS */
// => DOM ELEMENTS
let previewIntroImg = document.getElementById("modal-img-preview");
let previewIntroImgCaption = document.getElementById("modal-img-caption");
let streamBtnGrp = document.getElementById("stream-btn-grp");

let archiveBtn = document.getElementById("archive-btn");
let liveBtn = document.getElementById("live-btn");
let pendingBtn = document.getElementById("pending-btn");
let streamConfBtn = document.getElementById("stream-confirmation-btn");
let technicalDiffBtn = document.getElementById("technical-diff-btn");

archiveBtn.addEventListener("click", onArchiveClick);
liveBtn.addEventListener("click", onLiveClick);
streamConfBtn.addEventListener("click", onPendingClick);
technicalDiffBtn.addEventListener("click", onTechnicalDiff);


// => METHODS
function onArchiveClick() {
  unityFetch("/stopStreamAndDisplayConclusionSlide", { method: "PUT" })
    .then((response) => {
      if (response.ok && response.status === 200) {
        Feedback.alertSuccess("Success: Stream stopped.");
      } else if (response.ok && response.status === 201) {
        Feedback.alertInfo(response.statusText);
      } else {
        Feedback.alertDanger("Failed: " + response.statusText);
      }
    });
}

function onLiveClick() {
  sendClickEvent(myVideoPlayer, OperatorControls._LiveButton);
}

function onPendingClick() {
  unityFetch("/startStreamAndDisplayIntroSlide", { method: "PUT" })
    .then((response) => {
      if (response.ok && response.status === 200) {
        Feedback.alertSuccess("Success: Stream started.");
      } else if (response.ok && response.status === 201) {
        Feedback.alertInfo(response.statusText);
      } else {
        sendClickEvent(myVideoPlayer, OperatorControls._LiveButton);
        Feedback.alertDanger("Failed: Could not start stream, please check settings.");
      }
    });
}

function onTechnicalDiff() {
  sendClickEvent(myVideoPlayer, OperatorControls._TechnicalDifficultiesButton);
}

function resetStreamButtonsOnLeaveOrEnd() {
  if (pendingBtn.innerHTML === "Intro Slide") pendingBtn.innerHTML = "Start Stream";
  if (streamSettingsFieldset.disabled) streamSettingsFieldset.disabled = false;
  if (streamBtnGrp.classList.contains("w-100")) streamBtnGrp.classList.remove("w-100");
  if (!pendingBtn.classList.contains("rounded")) pendingBtn.classList.add("rounded");
  if (!liveBtn.classList.contains("d-none")) liveBtn.classList.add("d-none");
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
  technicalDiffBtn.innerHTML = "Technical Difficulties";
  archiveBtn.innerHTML = "Conclusion Slide";
  streamBtnGrp.classList.add("w-100");
  pendingBtn.classList.remove("rounded");
  liveBtn.classList.remove("d-none");
  technicalDiffBtn.classList.remove("d-none");
  archiveBtn.classList.remove("d-none");
  pendingBtn.removeAttribute("data-bs-toggle");
  pendingBtn.addEventListener("click", onPendingClick);
  intro_preview.removeAttribute("data-bs-toggle");
  intro_preview.addEventListener("click", onPendingClick);
}


/* ZOOM CONTROLS */
// => DOM ELEMENTS
let joinMeetingBtn = document.getElementById("join-meeting-btn");
let leaveMeetingBtn = document.getElementById("leave-meeting-btn");
let meetingNumberInput = document.getElementById("meeting-number-input");
let meetingPasswordInput = document.getElementById("meeting-password-input");

// => METHODS
function onJoinClick() {
  // Meeting number can also be entered as a URI. This is helpful since query parameters can be passed along with the meeting number.
  let meetingNumberUri = encodeURIComponent(meetingNumberInput.value)
  unityFetch(`/joinMeeting?meetingId=${meetingNumberUri}&password=${meetingPasswordInput.value}`, { method: "PUT" })
    .then(response => {
      if (response.ok) {
        console.log("Joined meeting");
      } else {
        console.log(response.statusText);
      }
    });
}

function onLeaveClicked() {
  unityFetch(`/leaveMeeting`, { method: "PUT" })
    .then(response => {
      if (response.ok) {
        console.log("Left meeting");
      } else {
        console.log(response.statusText);
      }
    });
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

let enableAutoShowOnJoin = document.getElementById("enable-autoshow-btn");
let enableOutputAudioOnJoin = document.getElementById("enable-automute-btn");
let deleteGroupBtn = document.getElementById("delete-grp-btn");
let disableAutoShowOnJoin = document.getElementById("disable-autoshow-btn");
let disableOutputAudioOnJoin = document.getElementById("disable-automute-btn");
let groupParticipantsBtn = document.getElementById("group-select-ppt-btn");
let hideAllLowerThirdsBtn = document.getElementById("hide-all-lower-thirds-btn");
let hideSelectParticipantBtn = document.getElementById("hide-select-ppt-btn");
let muteSelectParticipantBtn = document.getElementById("mute-select-ppt-btn");
let participantsGroupLabelSubmitBtn = document.getElementById("ppt-grp-label-submit");
let removeParticipantsBtn = document.getElementById("remove-select-ppt-btn");
let selectAllParticipantBtn = document.getElementById("check-uncheck-all-ppt-btn");
let showAllLowerThirdsBtn = document.getElementById("show-all-lower-thirds-btn");
let showSelectParticipantBtn = document.getElementById("show-select-ppt-btn");
let unmuteSelectParticipantBtn = document.getElementById("unmute-select-ppt-btn");

// => PRIMITIVE AND OTHER TYPES
let participantInputGroups = [];
let participantJsonParsed = null;
let groupJsonParsed = null;

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

function onEnableAutoShowOnJoin() {
  unityFetch("/enableOutputVideoByDefault?enable=true", { method: "PUT" });
}

function onEnableAutoMuteOnJoin() {
  unityFetch("/enableOutputAudioByDefault?enable=false", { method: "PUT" });
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

function onDisableAutoShowOnJoin() {
  unityFetch("/enableOutputVideoByDefault?enable=false", { method: "PUT" });
}

function onDisableAutoMuteOnJoin() {
  unityFetch("/enableOutputAudioByDefault?enable=true", { method: "PUT" });
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
  validateParticipantInputGroups();
  validateParticipantOnVidCtrls();
}

function setupParticipantInputGroup(node) {
  node.style.display = "flex";
  let idx = participantInputGroups.length - 1;
  let renameBtn = document.querySelector("div#" + node.id + " .rename-btn");
  let visibilityBtn = document.querySelector("div#" + node.id + " .visibility-btn");
  let audibilityBtn = document.querySelector("div#" + node.id + " .audibility-btn");
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
      let p1 = participantJsonParsed[currentIdx];
      let p2 = participantJsonParsed[droppedIdx];
      let str = p1.id + "," + p2.id;
      sendStringSubmitEvent(myVideoPlayer, OperatorControls._SwapParticipantsButton, str);
    }
  }

  visibilityBtn.addEventListener("click", function () {
    let p = participantJsonParsed[idx];
    let str = p.id + "," + !p.visible;
    sendStringSubmitEvent(myVideoPlayer, OperatorControls._ToggleParticipantVisibilityButton, str);
  })

  audibilityBtn.addEventListener("click", function () {
    let p = participantJsonParsed[idx];
    unityFetch(`/muteParticipantAudioSource?participantId=${p.id}&mute=${!p.mutedAudioSource}`, { method: "PUT" })
      .then(resp => {
        if (resp.ok) {
          console.log("audibility toggled");
        }
      });
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
    groupParticipantsBtn.disabled = true;
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
    let audibilityBtn = document.querySelector(`#${clone.id} .audibility-btn`);
    let nameSpan = document.querySelector(`#${clone.id} .name-span`);

    visibilityBtn.firstChild.className = data.visible ? "bi bi-eye" : "bi bi-eye-slash";
    audibilityBtn.firstChild.className = data.mutedAudioSource ? "bi bi-ear" : "bi bi-ear-fill";
    if (data.title === "") {
      nameSpan.innerHTML = `<b>${data.name}</b>`;
    } else {
      nameSpan.innerHTML = `<b>${data.name}</b>&nbsp-&nbsp<i>${data.title}</i>`;
    }
  }
  ValidateClonesWithJsonArray(participantInputGroupOg, allParticipantsDiv, participantInputGroups, setupParticipantInputGroup, participantJsonParsed, validateParticipantInputGroup);
}

// => EVENT LISTENERS
enableAutoShowOnJoin.addEventListener("click", onEnableAutoShowOnJoin);
enableOutputAudioOnJoin.addEventListener("click", onEnableAutoMuteOnJoin);
deleteGroupBtn.addEventListener("click", onDeleteGroupBtnClicked);
disableAutoShowOnJoin.addEventListener("click", onDisableAutoShowOnJoin);
disableOutputAudioOnJoin.addEventListener("click", onDisableAutoMuteOnJoin);
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

muteSelectParticipantBtn.addEventListener("click", () => {
  let selectedParticipants = mapSelectParticipantsToInputGroups();
  for (let i = 0; i < selectedParticipants.length; i++) {
    if (selectedParticipants[i].checked && !participantInputGroups[i].classList.contains('d-none')) {
      let p = participantJsonParsed[i];
      unityFetch(`/muteParticipantAudioSource?participantId=${p.id}&mute=true`, { method: "PUT" });
    }
  }
});

selectAllParticipantBtn.addEventListener("click", () => {

  if (selectAllParticipantBtn.innerHTML === "Select All") {
    selectAllParticipantBtn.innerHTML = "Unselect All";
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

unmuteSelectParticipantBtn.addEventListener("click", () => {
  let selectedParticipants = mapSelectParticipantsToInputGroups();
  for (let i = 0; i < selectedParticipants.length; i++) {
    if (selectedParticipants[i].checked && !participantInputGroups[i].classList.contains('d-none')) {
      let p = participantJsonParsed[i];
      unityFetch(`/muteParticipantAudioSource?participantId=${p.id}&mute=false`, { method: "PUT" });
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
let lowerThirdStyleDropdown = document.getElementById("lower-thirds-style-dropdown");
let textSizeDropdown = document.getElementById("text-size-dropdown");

let cropScreenShareBtn = document.getElementById("crop-screen-share-btn");
let cropScreenShareApplyBtn = document.getElementById("crop-screen-share-apply-btn");
let cropScreenShareCloseBtn = document.getElementById("crop-screen-share-close-btn");

// => PRIMITIVE AND OTHER TYPES
let cropWidget = new CropWidget(cropScreenSharePreview);

// => METHODS
function editStyleSelectionChanged() {
  if (layout_editor) {
    layout_editor.destroy();
  }
  let style = editStyleSelect.options[editStyleSelect.selectedIndex];
  let category = style.parentElement.label;
  unityFetch(`/getStyle?category=${category}&title=${style.label}`).then(resp => {
    if (resp.ok) {
      resp.text().then(onReceiveStyleSchema);
    }
  });
}

function onEditStyleSelectClicked() {
  // Tell user that the styles are being fetched.
  editStyleSelect.innerHTML = "<option>Loading...</option>";
  unityFetch("/getStylesAvailable").then(resp => {
    if (!resp.ok) {
      editStyleSelect.innerHTML = "<option>Failed to load styles</option>";
    } else {
      resp.json().then(json => {
        // Clear the select.
        editStyleSelect.innerHTML = "";
        // Iterate through the keys of the JSON object.
        for (let category in json) {
          // Create a new optgroup for the category.
          let optgroup = document.createElement("optgroup");
          optgroup.label = category;
          // Iterate through the styles in the category.
          for (let style of json[category]) {
            // Create a new option for the style.
            let option = document.createElement("option");
            option.label = style;
            // Add the option to the optgroup.
            optgroup.appendChild(option);
          }
          // Add the optgroup to the select.
          editStyleSelect.appendChild(optgroup);
        }
      });
      // Add the event listener for when the user selects a style.
      editStyleSelect.addEventListener("change", editStyleSelectionChanged);
      // Available styles is static data, so we don't need to fetch it again.
      editStyleSelect.removeEventListener("click", onEditStyleSelectClicked)
    }
  });
}

function onCropScreenShareApplyBtnClicked() {
  let crop = cropWidget.getNormalizedCrop();
  unityFetch(`/cropScreenShare?x=${crop.left}&y=${crop.bottom}&scale=${crop.width}`, { method: "PUT" })
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

function onLayoutSelected(elem) {
  let preset = elem.dataset.preset ? elem.dataset.preset : "";
  unityFetch(`/setStyle?title=${elem.dataset.title}&category=Layout&preset=${preset}`, { method: "PUT" });
}

function onTextSizeSelected(elem) {
  sendStringSubmitEvent(myVideoPlayer, OperatorControls._SetSizeOfLowerThird, elem.value.toString());
}

function onLowerThirdStyleSelected(elem) {
  unityFetch(`/setStyle?title=${elem.dataset.title}&category=Lower Third`, { method: "PUT" });
}

function setupDropdown(dropdown, func) {
  for (let i = 0; i < dropdown.children.length; i++) {
    let child = dropdown.children[i]
    child.firstChild.onclick = function () {
      func(child)
    }
  }
}

// => EVENT LISTENERS
cropScreenShareBtn.addEventListener("click", onCropScreenShareBtnClicked);
cropScreenShareApplyBtn.addEventListener("click", onCropScreenShareApplyBtnClicked);
editStyleSelect.addEventListener("click", onEditStyleSelectClicked);

cropScreenSharePreview.onload = function () {
  cropWidget.mainElement.style.display = "block";
  cropWidget.reset();
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
setupDropdown(lowerThirdStyleDropdown, onLowerThirdStyleSelected);

/* LAYOUT TAB -SCHEMA EDITOR */
// => DOM ELEMENTS
let layout_element = document.getElementById('layout-schema-editor');
let layout_editor;

// => PRIMITIVE AND OTHER TYPES
let layoutEditorValuesSetInCB = false;

// => METHODS
function onLayoutEditorChanged() {
  if (layoutEditorValuesSetInCB) {
    layoutEditorValuesSetInCB = false;
    return;
  }
  if (validateSchema()) {
    unityPutJson(`/setStyleParameters?title=${layout_editor.options.schema.title}&category=${layout_editor.options.schema.category}`, layout_editor.getValue())
  }
}

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

  layout_editor.on('ready', () => {
    // Now the api methods will be available
    validateSchema();
  });

  // layout_editor emits a change event immediately unless we wait a bit.
  setTimeout(() => {
    layout_editor.on('change', onLayoutEditorChanged);
  }, 1000);
}

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

// => INIT(S)
JSONEditor.defaults.options.disable_edit_json = true;
JSONEditor.defaults.options.disable_properties = true;


/* SLIDE TAB */
// => DOM ELEMENTS
let conc_preview = document.getElementById("conc-preview");
let intro_preview = document.getElementById("intro-preview");
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

function onSlideClearClicked() {
  sendClickEvent(myVideoPlayer, OperatorControls._LiveButton);
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

function setupSlideSetAsOptionsButton(owner) {
  let slideSetAsIntro = document.querySelector(`div#${owner.id} a[target="action-set-as-intro"]`);
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
  let setupSlide = function (slide) {
    slide.style.display = "flex";
    let span = document.querySelector(`#${slide.id} span`);
    let img = document.querySelector(`#${slide.id} img`);

    setupSlideSetAsOptionsButton(slide);
    setupDeleteButton(slide, "/uapp/deleteHoldingSlide?url={0}", span, onSlideTabClicked);
    img.addEventListener("click", function () {
      unityFetch("/setHoldingSlide?url=" + img.alt, { method: "PUT" })
        .then(response => {
          if (response.ok) {
            console.log("Slide set.");
          }
        });
    });
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
slideClearBtn.addEventListener("click", onSlideClearClicked);
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
  return String(Number(Math.round(parseFloat(value) * 100))) + "%";
}


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

musicProgress.addEventListener("change", function () {
  setTimeout(function () {
    disableMusicProgressUpdates = false;
  }, 1000);
  let str = musicProgress.value;
  sendStringSubmitEvent(myVideoPlayer, OperatorControls._SeekMusicButton, str);
});

musicPlayStopBtn.addEventListener("click", function () {
  if (musicPlayStopBtn.innerHTML === `<i class="bi bi-play"></i>`) {
    sendClickEvent(myVideoPlayer, OperatorControls._PlayHoldingMusic);
  } else {
    sendClickEvent(myVideoPlayer, OperatorControls._StopHoldingMusic);
  }
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
let videoSwitchBtn = document.getElementById("video-btn-element");

// => PRIMITIVE AND OTHER TYPES
let disableVideoProgressUpdates = false;
let videoSwitchBtns = [];

// => METHODS
function onVideoClearClicked() {
  sendClickEvent(myVideoPlayer, OperatorControls._LiveButton);
}

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
  let setupVideoSwitchBtn = function (videoBtn) {
    videoBtn.style.display = "flex";
    let label = document.querySelector(`#${videoBtn.id} span`);
    let img = document.querySelector(`#${videoBtn.id} img`);
    setupSlideSetAsOptionsButton(videoBtn);
    setupDeleteButton(videoBtn, "/uapp/deleteVideo?url={0}", label, FetchAllUploadedMediaAndUpdateDash);
    img.addEventListener("click", function () {
      unityFetch("/setHoldingSlide?url=" + img.alt, { method: "PUT" })
        .then(response => {
          if (response.ok) {
            console.log("Slide set");
          }
        });
    });
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
videoClearBtn.addEventListener("click", onVideoClearClicked);

videoProgress.addEventListener("input", function () {
  disableVideoProgressUpdates = true;
  videoPlaybackTime.innerHTML = convertSecondsToTimestamp(videoProgress.value);
});

videoProgress.addEventListener("change", function () {
  setTimeout(function () {
    disableVideoProgressUpdates = false;
  }, 1000);
  let str = videoProgress.value;
  sendStringSubmitEvent(myVideoPlayer, OperatorControls._SeekVideoButton, str);
});

videoPlayPauseBtn.addEventListener("click", function () {
  if (videoPlayPauseBtn.innerHTML === '<i class="bi bi-play"></i>') {
    sendClickEvent(myVideoPlayer, OperatorControls._PlayVideo);
  } else {
    sendClickEvent(myVideoPlayer, OperatorControls._PauseVideo);
  }
});

volumeRangeVideo.addEventListener("input", function () {
  let str = volumeRangeVideo.value;
  volumeLevelVideo.innerHTML = getVolumeLevel(volumeRangeVideo.value);
  sendStringSubmitEvent(myVideoPlayer, OperatorControls._VolumeVideo, str);
});

// => INIT(S)
volumeLevelVideo.innerHTML = getVolumeLevel(volumeRangeVideo.value);
videoSwitchBtn.style.display = "none";


/* UPLOAD TAB */
// => DOM ELEMENTS
let batchSlideFileInput = document.getElementById("batch-slide-file-input");
let conclusionSelect = document.getElementById("conclusion-slide-type-select");
let introSelect = document.getElementById("intro-slide-type-select");
let modalIntroCaption = document.getElementById("modal-intro-caption");
let modalIntroPreview = document.getElementById("modal-intro-preview");
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
let slideTypeSelects = [introSelect, techDiffSelect, conclusionSelect];
let extensionToMethod = {
  "music": ["mp3", "ogg", "wav"],
  "ppt": ["ppt", "pptm", "pptx"],
  "slide": ["png", "jpg", "jpeg"],
  "video": ["mp4", "mov"], "pdf": ["pdf"],
};
let formInput = [];
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
};

// => METHODS
function batchFileInputChanged() {
  clearFormInput();
  uploadDescriptor.innerHTML = ""; // Clear upload descriptor.
  let [slideFiles, musicFiles, videoFiles, pdfFiles, pptFiles]
    = SortFilesByExtension(batchSlideFileInput.files); // Sort files into categories.
  CategorizeSlideFilesByKeywordForUpload(slideFiles); // Categorize slides by keywords upload.

  // Simply push music and videos.
  for (let musicFile of musicFiles) {
    pushFormInput(musicFile, "music");
  }
  uploadDescriptor.innerHTML += `${musicFiles.length} music file(s), `;

  for (let videoFile of videoFiles) {
    pushFormInput(videoFile, "slide");
  }
  uploadDescriptor.innerHTML += `${pdfFiles.length} pdf file(s), `;

  for (let pdfFile of pdfFiles) {
    pushFormInput(pdfFile, "pdf");
  }
  uploadDescriptor.innerHTML += `${pptFiles.length} ppt file(s), `;

  for (let pptFile of pptFiles) {
    pushFormInput(pptFile, "ppt");
  }
  uploadDescriptor.innerHTML += ` and ${videoFiles.length} video file(s).`;
  uploadDescriptor.innerHTML += `${pdfFiles.length > 0 || pptFiles.length > 0 ?
    "<br><strong>Note: PDF/PPT files will be converted into slides, and will take longer to process.</strong>" : ""}`;
  editSlideBtn.style.display = "block"; // Show edit button.
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
      // Skip if not a video/slide.
      if (formInput[i].type !== "slide") continue;
      let option = document.createElement("option");
      option.value = formInput[i].ogName;
      option.innerText = formInput[i].ogName;
      select.appendChild(option);
      // Select option if it's name matches the slide type.
      if (formInput[i].assignTo === select.dataset.type) {
        select.selectedIndex = i + 1;
      }
    }
  }
}

function editSlideSaveBtnClicked() {
  clearFormInput();
  resetEditSlideAssignmentPreviewElements();
  // Clear descriptor
  uploadDescriptor.innerHTML = "";
  let [slideFiles, musicFiles, videoFiles] = SortFilesByExtension(batchSlideFileInput.files);
  // Combine video and slide files.
  slideFiles = slideFiles.concat(videoFiles);
  CategorizeSlideFilesBySlideTypeSelects(slideFiles);
  // Simply push music files.
  for (let musicFile of musicFiles) {
    pushFormInput(musicFile, "music");
  }
  uploadDescriptor.innerHTML += `${musicFiles.length} music file(s), `;
  uploadDescriptor.innerHTML += ` and ${videoFiles.length} video file(s).`;
}

function CategorizeSlideFilesByKeywordForUpload(files) {
  let accountedSlides = [];
  let customSlideCount = 0;

  for (let i = 0; i < files.length; i++) {
    let file = files[i];

    // Identify the type of slide being uploaded.
    if (!Object.keys(typeToKeyWords).some(tKey => {

      // Check if type is already accounted for.
      if (accountedSlides.includes(tKey)) return false;
      let keywords = typeToKeyWords[tKey]; // Get keywords associated with type.

      // Search for keywords in file name.
      if (keywords.some(keyword => file.name.toLowerCase().includes(keyword))) {
        pushFormInput(file, "slide", tKey); // Append to form input. Will be assigned as found type after upload.
        uploadDescriptor.innerHTML += `'${file.name}' will be used as your ${tKey} slide.<br>`;
        accountedSlides.push(tKey);
        return true;
      }
      return false; // keep looking.
    })) {
      pushFormInput(file, "slide"); // Type could not be identified. Will upload as custom slide.
      customSlideCount++;
    }
  }
  uploadDescriptor.innerHTML += `You will be uploading ${customSlideCount} custom slide(s), `;
}

function CategorizeSlideFilesBySlideTypeSelects(files) {
  let customSlideCount = 0;

  // Iterate through files from batch slide file input.
  for (let i = 0; i < files.length; i++) {
    let file = files[i];
    let select = slideTypeSelects.filter(select => {
      return file.name === select.value; // Check if file name matches select value.
    }); // Find slide type from select.

    if (select !== []) {
      let arr = [];

      // if assigned to multiple types, find all types.
      for (let i = 0; i < select.length; i++) {
        arr.push(select[i].dataset.type);
      }

      pushFormInput(file, "slide", arr); // Type identified. Append to form input. Will be uploaded as found type.
      uploadDescriptor.innerHTML += `'${file.name}' will be used as your ${arr.join(", ")} slide.<br>`;
    } else {
      // Type could not be identified. Will upload as custom slide.
      pushFormInput(file, "slide");
      customSlideCount++;
    }
  }
  uploadDescriptor.innerHTML += `You will be uploading ${customSlideCount} custom slide(s), `;
}

function clearFormInput() {
  formInput = [];
}

// loads file preview based on user selection
function fileReaderHelper(previewEl, selection) {
  const fileReader = new FileReader();
  fileReader.onload = e => {
    previewEl.src = e.target.result;
  }
  fileReader.readAsDataURL(formInput[selection.selectedIndex - 1].file);
}

function FetchAllUploadedMediaAndUpdateDash() {
  onSlideTabClicked(); // Fetch custom slides.
  onMusicTabClicked(); // Fetch holding music.
  onVideoTabClicked(); // Fetch videos.
}

function pushFormInput(file, type, assignTo = []) {
  formInput.push({
    type: type,
    assignTo: assignTo,
    ogName: file.name,
    file: file
  });
}

// reset preview elements upon modal close or save.
function resetEditSlideAssignmentPreviewElements() {
  modalIntroCaption.innerHTML = modalTechDiffCaption.innerHTML = modalConclusionCaption.innerHTML
    = "No slide selected to preview";

  modalIntroPreview.src = modalTechDiffPreview.src = modalConclusionPreview.src = "...";

  modalIntroPreview.classList.add("d-none");
  modalTechDiffPreview.classList.add("d-none");
  modalConclusionPreview.classList.add("d-none");
}

function SortFilesByExtension(files) {
  let slideFiles = [];
  let musicFiles = [];
  let videoFiles = [];
  let pdfFiles = [];
  let pptFiles = [];

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
      uploadDescriptor.innerHTML += `Unknown file type: ${file.name}<br>`;
    }
  }
  return [slideFiles, musicFiles, videoFiles, pdfFiles, pptFiles];
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
      clearFormInput();
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
editSlideCloseBtn.addEventListener("click", resetEditSlideAssignmentPreviewElements);
editSlideSaveBtn.addEventListener("click", editSlideSaveBtnClicked);
videoSelect.addEventListener("change", UpdateVideoBrowsePreviewElement);


conclusionSelect.addEventListener("change", () => {
  modalConclusionCaption.innerHTML = conclusionSelect.value + " will be assigned as your conclusion slide.";
  fileReaderHelper(modalConclusionPreview, conclusionSelect);
  modalConclusionPreview.classList.remove("d-none");
});
introSelect.addEventListener("change", () => {
  modalIntroCaption.innerHTML = introSelect.value + " will be assigned as your intro slide.";
  fileReaderHelper(modalIntroPreview, introSelect);
  modalIntroPreview.classList.remove("d-none");
});
techDiffSelect.addEventListener("change", () => {
  modalTechDiffCaption.innerHTML = techDiffSelect.value + " will be assigned as your tech diff slide.";
  fileReaderHelper(modalTechDiffPreview, techDiffSelect);
  modalTechDiffPreview.classList.remove("d-none");
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
let navSlideTabBtn = document.getElementById("nav-slide-tab");
let navMusicTabBtn = document.getElementById("nav-music-tab");
let navVideoTabBtn = document.getElementById("nav-video-tab");
let navLogTabBtn = document.getElementById("nav-log-tab");
let navUploadTabBtn = document.getElementById("nav-upload-tab");
let navRecordingTabBtn = document.getElementById("nav-recording-tab");

// => EVENT LISTENERS
navZoomTabBtn.addEventListener("click", () => { navZoomTabBtn.scrollIntoView(); });
navPartTabBtn.addEventListener("click", () => { navPartTabBtn.scrollIntoView(); });
navLayoutTabBtn.addEventListener("click", () => { navLayoutTabBtn.scrollIntoView(); });
navSlideTabBtn.addEventListener("click", () => { onSlideTabClicked(); navSlideTabBtn.scrollIntoView(); });
navMusicTabBtn.addEventListener("click", () => { onMusicTabClicked(); navSlideTabBtn.scrollIntoView(); });
navVideoTabBtn.addEventListener("click", () => { onVideoTabClicked(); navVideoTabBtn.scrollIntoView(); });
navLogTabBtn.addEventListener("click", () => { navLogTabBtn.scrollIntoView(); fetchLogs(); });
navUploadTabBtn.addEventListener("click", () => { navUploadTabBtn.scrollIntoView(); });
navRecordingTabBtn.addEventListener("click", () => { navRecordingTabBtn.scrollIntoView(); });

/* ADVANCED SETTINGS */
// => DOM ELEMENTS
let advancedSettingsToggle = document.getElementById("advancedSettingsToggle");
let participantAutoShowBtnGrp = document.getElementById("participant-autoshow-btn-grp");

// => EVENT LISTENERS
advancedSettingsToggle.addEventListener("change",
  () => { onEnableAdvancedSettings(advancedSettingsToggle, navZoomTabBtn, streamAuthSettings, participantAutoShowBtnGrp, navLayoutTabBtn, navLogTabBtn) });

/*** APP STATUS METHOD ***/
function appStatusReceived(json) {

  let appStatus = JSON.parse(json);

  ActivateButtonHelper(pendingBtn, false);
  ActivateButtonHelper(technicalDiffBtn, false);
  ActivateButtonHelper(liveBtn, false);
  ActivateButtonHelper(archiveBtn, false);

  addParticipantSelectCheckEventListener(); // adds event listeners to each select checkbox

  generalStatBar.innerHTML = `Zoom Local Recording: ${appStatus.canRecordLocalFiles ? "Allowed" : "Not Allowed"}`;

  if (appStatus.inMeeting || appStatus.meetingSimulated) {
    validateTracksInPlaylist(appStatus.playlist, appStatus.currentlyPlayingIndex);
    meetingNoInputField.disabled = true;
    joinMeetingBtn.disabled = true;
    holdMusicFieldset.disabled = false;
    musicPlayStopBtn.innerHTML = appStatus.playingHoldingMusic ? '<i class="bi bi-stop"></i>' : '<i class="bi bi-play"></i>';
    currentlyPlayingSpan.innerHTML = currentlyPlayingSpan.title = appStatus.currentlyPlayingTrack;
    volumeRangeMusic.value = appStatus.holdingMusicVolume;
    volumeLevelMusic.innerHTML = getVolumeLevel(volumeRangeMusic.value);

    //videoFieldsetBar.disabled = !jsonParsed.videoIsShowing;
    volumeRangeVideo.value = appStatus.currentVideoVolume;
    volumeLevelVideo.innerHTML = getVolumeLevel(volumeRangeVideo.value);
    musicProgress.max = Math.round(appStatus.currentTrackDuration);
    videoProgress.max = Math.round(appStatus.currentVideoDuration);
    videoPlayPauseBtn.innerHTML = appStatus.playingVideo ? '<i class="bi bi-pause"></i>' : '<i class="bi bi-play"></i>';

    if (appStatus.streaming) {

      updateStreamButtons();
      updatestreamActivityBarInfo(appStatus);

      if (appStatus.holdingSlide === "intro") {
        pendingBtn.innerHTML = `Intro Slide <i class="bi bi-broadcast"></i>`;
        ActivateButtonHelper(pendingBtn, true);
      } else if (appStatus.holdingSlide === "technicalDifficulties") {
        technicalDiffBtn.innerHTML = `Techincal Difficulties <i class="bi bi-broadcast"></i>`;
        ActivateButtonHelper(technicalDiffBtn, true);
      } else if (appStatus.holdingSlide === "none" || appStatus.isCustomSlide) {
        liveBtn.innerHTML = `Live <i class="bi bi-broadcast"></i>`;
        ActivateButtonHelper(liveBtn, true);
      } else if (appStatus.holdingSlide === "conclusion") {
        ActivateButtonHelper(archiveBtn, true);
      }
    } else {
      resetStreamButtonsOnLeaveOrEnd();
      resetStreamActivityBarInfo();
      // todo: This causes a custom slide named "conclusion" to immediately be dismissed.
      // if (jsonParsed.holdingSlide === "endOfStream" || jsonParsed.holdingSlide === "conclusion") {
      //   sendClickEvent(myVideoPlayer, OperatorControls._LiveButton);
      // }
    }

    if (appStatus.secondClickEndsStream) {
      archiveBtn.innerHTML = `End Stream <i class="bi bi-broadcast"></i>`;
    } else {
      archiveBtn.innerHTML = "Conclusion Slide";
    }

  } else {
    resetStreamActivityBarInfo();
    resetStreamButtonsOnLeaveOrEnd();
    generalStatBar.innerHTML = "Connection State: Connected";
    meetingNoInputField.disabled = false;
    joinMeetingBtn.disabled = false;
    holdMusicFieldset.disabled = true;
    //videoFieldsetBar.disabled = true;
  }

  function ActivateButtonHelper(btn, active) {
    if (active) {
      btn.classList.remove("deactivated");
      btn.classList.add("activated");
    } else {
      btn.classList.remove("activated");
      btn.classList.add("deactivated");
    }
  }
}
