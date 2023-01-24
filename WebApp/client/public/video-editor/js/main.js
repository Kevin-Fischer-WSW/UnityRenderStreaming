import {Timeline} from "./timeline.js";

let timeline = new Timeline(30, 0.1, 2);
document.getElementById('timeline-container').appendChild(timeline.element);

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
      console.log(clips);
    }
  }
}

GetClips();

let addClipButton = document.getElementById('add-clip');
addClipButton.addEventListener('click', () => {
  timeline.createClip("clip", 30);
});
let insertClipButton = document.getElementById('insert-clip');
insertClipButton.addEventListener('click', () => {
  timeline.insertClip("clip", 30, timeline.selectedClipIndex);
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
