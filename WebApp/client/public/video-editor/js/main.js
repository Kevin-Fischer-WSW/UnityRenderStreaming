import {Timeline} from "./timeline.js";
import {unityFetch} from "../../js/unity-fetch.js";

let timeline = new Timeline(30, 0.1, 2);
document.getElementById('timeline-container').appendChild(timeline.element);


let clipDropdown = document.getElementById('clip-dropdown');

// Get a list of the recorded video files
let clips = [];

async function GetClips() {
  let resp1 = await unityFetch('/getStreamServiceSettings')
  let data1 = await resp1.json()
  if (resp1.ok) {
    let resp2 = await fetch(`/listRecordings/${data1.streamServiceSettings.key}`)
    let data2 = await resp2.json()
    if (resp2.ok) {
      clips = data2;
      for (let i = 0; i < clips.length; i++) {
        clipDropdown.innerHTML += `<li value="${i}"><button class="dropdown-item">${clips[i].file}</button></li>`;
      }
      clipDropdown.addEventListener('click', (event) => {
        let clipIndex = event.target.parentElement.value;
        if (addAndNotInsertButtonPressedLast) {
          timeline.createClip(clips[clipIndex].file, clips[clipIndex].duration);
        } else {
          timeline.insertClip(clips[clipIndex].file, clips[clipIndex].duration, timeline.selectedClipIndex);
        }
      });
    }
  }
}

let projectDropdownBtn = document.getElementById('project-dropdown-btn');
let projectDropdown = document.getElementById('project-dropdown');
projectDropdownBtn.addEventListener('click', () => {
  projectDropdown.innerHTML = '';
  GetProjects();
});

async function GetProjects() {
  let resp = await fetch('/listVideoEditingProjects')
  let data = await resp.json()
  if (resp.ok) {
    for (let i = 0; i < data.length; i++) {
      projectDropdown.innerHTML += `<li value="${i}"><button class="dropdown-item">${data[i]}</button></li>`;
    }
    projectDropdown.addEventListener('click', (event) => {
      let projectIndex = event.target.parentElement.value;
      loadProject(data[projectIndex]);
    });
  }
}

let projectNameInput = document.getElementById('project-name');
async function loadProject(projectName) {
  let resp = await fetch(`/videoEditingProjectData/${projectName}`)
  let data = await resp.json()
  if (resp.ok) {
    timeline.setJson(data)
    projectNameInput.value = projectName;
  }
}

GetClips();


let saveProjectButton = document.getElementById('save-project');
saveProjectButton.addEventListener('click', () => {
  let projectName = projectNameInput.value;
  let projectData = timeline.getJson();
  let data = {
    projectName: projectName,
    projectData: projectData
  };
  fetch('/submitVideoEdits', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  }).then((response) => {
    if (response.ok) {
      alert('Project saved');
    } else {
      alert('Error saving project');
    }
  });
});

let deleteProjectButton = document.getElementById('delete-project');
deleteProjectButton.addEventListener('click', () => {
  let projectName = projectNameInput.value;
  fetch(`/deleteVideoEditingProject/${projectName}`, {
    method: 'DELETE'
  }).then((response) => {
    if (response.ok) {
      alert('Project deleted');
      projectNameInput.value = '';
    } else {
      alert('Error deleting project');
    }
  });
});

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
  updateTimeSlider()
});

let timeSlider = document.getElementById('time-slider');
timeSlider.addEventListener('input', () => {
  timeline.setTime(timeSlider.value / timeSlider.max);
});

timeline.addEventListener('duration-changed', () => {
  updateTimeSlider()
});

function updateTimeSlider(){
  let c = timeline.getDurationOfClipsMinusCuts() - timeline.getZoomedTimeSpan();
  if (c > 0){
    timeSlider.value = timeline.timeSpanStart;
    timeSlider.max = c;
  }else{
    timeSlider.max = 0;
  }
}
