import {Timeline} from "./timeline.js";

let timeline = new Timeline(30, 0.1, 2);
document.getElementById('timeline-container').appendChild(timeline.element);

let clipDropdown = document.getElementById('clip-dropdown');

// Get a list of the recorded video files
let clips = [];
async function GetClips(){
  let resp1 = await fetch('/getStreamPref')
  let data1 = await resp1.json()
  if (resp1.ok) {
    let resp2 = await fetch(`/listRecordings/${data1.settings.key}`)
    let data2 = await resp2.json()
    if (resp2.ok) {
      clips = data2;
      for (let i = 0; i < clips.length; i++) {
        clipDropdown.innerHTML += `<li value="${i}"><a class="dropdown-item">${clips[i].file}</a></li>`;
        clipDropdown.firstChild.addEventListener('click', () => {
          if (addAndNotInsertButtonPressedLast){
            timeline.createClip(clips[i].file, clips[i].duration);
          }else{
            timeline.insertClip(timeline.selectedClipIndex, clips[i].file, clips[i].duration);
          }
        });
      }
    }
  }
}

GetClips();

let addAndNotInsertButtonPressedLast = false;

let addClipButton = document.getElementById('add-clip');
addClipButton.addEventListener('click', () => {
  addAndNotInsertButtonPressedLast = true;
});
let insertClipButton = document.getElementById('insert-clip');
insertClipButton.addEventListener('click', () => {
  addAndNotInsertButtonPressedLast = false;
});
let deleteClipButton = document.getElementById('delete-clip');
deleteClipButton.addEventListener('click', () => {
  timeline.deleteClip(timeline.selectedClipIndex);
});

let createCutButton = document.getElementById('create-cut');
createCutButton.addEventListener('click', () => {
  timeline.createCut();
});

let zoomSlider = document.getElementById('zoom-slider');
zoomSlider.addEventListener('input', () => {
  timeline.setZoom(zoomSlider.value);
});
let timeSlider = document.getElementById('time-slider');
timeSlider.addEventListener('input', () => {
  timeline.setTime(timeSlider.value);
});
