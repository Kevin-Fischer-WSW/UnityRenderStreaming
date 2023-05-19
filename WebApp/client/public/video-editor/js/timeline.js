const SelectionState = {
  notSelecting: "notSelecting",
  selecting: "selecting",
  movingStart: "movingStart",
  movingEnd: "movingEnd",
  selectionMade: "selectionMade"
}

export class Timeline extends EventTarget {
  constructor(timeSpanAtNormalZoom, zoomMin, zoomMax) {
    super();
    this.timelineElement = document.createElement('div');
    this.timelineElement.id = 'timeline';
    this.timelineElement.classList.add('timeline');

    this.noClipElement = document.createElement('div');
    this.noClipElement.id = 'no-clip';
    this.noClipElement.classList.add('no-clip');
    this.noClipElement.innerHTML = 'No clips have been added yet.';

    this.timeLineClipsElement = document.createElement('div');
    this.timeLineClipsElement.id = 'timeline-clips';
    this.timeLineClipsElement.classList.add('timeline-clips');

    this.selectionElement = document.createElement('div');
    this.selectionElement.id = 'selection';
    this.selectionElement.classList.add('selection');

    this.selectionStartElement = document.createElement('div');
    this.selectionStartElement.id = 'selection-start';
    this.selectionStartElement.classList.add('selection-start');

    this.selectionEndElement = document.createElement('div');
    this.selectionEndElement.id = 'selection-end';
    this.selectionEndElement.classList.add('selection-end');

    this.selectionElement.appendChild(this.selectionStartElement);
    this.selectionElement.appendChild(this.selectionEndElement);

    this.timeSpanStartElement = document.createElement('div');
    this.timeSpanStartElement.id = 'time-span-start';
    this.timeSpanStartElement.classList.add('time-span-start');
    this.timeSpanEndElement = document.createElement('div');
    this.timeSpanEndElement.id = 'time-span-end';
    this.timeSpanEndElement.classList.add('time-span-end');

    this.timeLineTicksElement = document.createElement('div');
    this.timeLineTicksElement.id = 'timeline-ticks';
    this.timeLineTicksElement.classList.add('timeline-ticks');

    this.timelineElement.appendChild(this.noClipElement);
    this.timelineElement.appendChild(this.timeLineClipsElement)
    this.timelineElement.appendChild(this.selectionElement);
    this.timelineElement.appendChild(this.timeLineTicksElement);
    this.timelineElement.appendChild(this.timeSpanStartElement);
    this.timelineElement.appendChild(this.timeSpanEndElement);

    this.timelineElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));

    this.clips = [];
    this.cutSpans = [];
    this.smallestCutSpanAllowed = 0.03;

    this.currentX = 0;
    this.downX = 0;
    this.upperLimit = 0;
    this.lowerLimit = 0;

    this.selectingState = SelectionState.notSelecting;
    this.selectedClipIndex = -1;
    this.selectionStart = 0;
    this.selectionEnd = 0;

    this.timeSpanStartNorm = 0;
    this.timeSpanStart = 0;
    this.timeSpanEnd = 0;
    this.timeSpanAtNormalZoom = timeSpanAtNormalZoom;

    this.playHeadTime = 0;

    this.zoom = 1;
    this.zoomMin = zoomMin;
    this.zoomMax = zoomMax;
    this.zoomToTickSpan = {
      levelThresholds: [0.2, 1.5],
      spanAtLevels: [0.03, 1, 10],
      heightChangesAtLevels: [
        [1],
        [5, 10],
        [10, 30]
      ]
    };

    this.setTime(0);
    this.showSelection(false);
    this.updateWholeTimeline();
  }

  get element() {
    return this.timelineElement;
  }

  clearSelection() {
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.selectingState = SelectionState.notSelecting;
    this.updateSelectionElementStyle(0, 0);
    this.showSelection(false);
  }

  createClip(name, duration) {
    let clip = {
      name: name,
      duration: duration
    };
    this.clips.push(clip);
    this.updateWholeTimeline();
    this.invokeWholeDurationChanged();
  }

  createCut() {
    if (this.selectingState !== SelectionState.selectionMade) {
      alert('You must select a span of time before creating a cut.');
      return;
    }
    // Check if the selection is too small
    if (this.selectionEnd - this.selectionStart < this.smallestCutSpanAllowed) {
      alert('The selection must be at least ' + this.smallestCutSpanAllowed + ' seconds long.');
      return;
    }
    // Check if the selection overlaps with any other cuts.
    for (let i = 0; i < this.cutSpans.length; i++) {
      if (this.cutSpans[i].apparentStart >= this.selectionStart && this.cutSpans[i].apparentStart <= this.selectionEnd) {
        alert('You may not cut sections that contain other cuts.')
        // todo delete the cuts instead.
        return;
      }
    }
    // Create a new cut span
    let [_inpoint, _outpoint] = this.getInpointOutpointFromSelection();
    let cutSpan = {
      clipIndex: this.selectedClipIndex,
      inpoint: _inpoint,
      outpoint: _outpoint,
      apparentStart: this.selectionStart, // Marks where the cut appears in the timeline
    };
    // Splice the cut span into the list of cut spans, such that cut spans is sorted by apparentStart.
    let spliceAt = 0
    while (spliceAt < this.cutSpans.length && cutSpan.apparentStart > this.cutSpans[spliceAt].apparentStart) spliceAt++
    this.cutSpans.splice(spliceAt, 0, cutSpan);
    this.updateApparentStartsOfCutsAfterInsertingCut(cutSpan);
    // Update the timeline
    this.clearSelection();
    this.updateWholeTimeline();
    this.invokeWholeDurationChanged();
  }

  deleteClip(clipIndex) {
    if (clipIndex < 0 || clipIndex >= this.clips.length) {
      alert('The clip index is out of range.');
      return;
    }
    this.updateClipIndexAndApparentStartAfterDeletingClip(clipIndex);
    // Update the timeline
    this.clearSelection();
    this.updateWholeTimeline();
    this.invokeWholeDurationChanged();
  }

  deleteCut(clipIndex) {
    // Remove the cut from the list of cuts.
    let cutSpan = this.cutSpans[clipIndex];
    this.updateApparentStartsOfCutsAfterDeletingCut(cutSpan);
    // Set the selection to the cut.
    this.selectedClipIndex = cutSpan.clipIndex;
    this.selectionStart = cutSpan.apparentStart;
    this.selectionEnd = cutSpan.outpoint - cutSpan.inpoint + cutSpan.apparentStart;
    this.selectingState = SelectionState.selectionMade;
    // Ensure selection is visible.
    this.showSelection(true);
    this.updateSelectionStartEndElementInnerText();
    // Update the timeline.
    this.updateWholeTimeline();
    this.invokeWholeDurationChanged();
  }

  getClipIndexAtNorm(norm) {
    let time = this.normToTime(norm);
    let totalDuration = 0;
    for (let i = 0; i < this.clips.length; i++) {
      let clip = this.clips[i];
      totalDuration += this.getDurationOfClipMinusCuts(i);
      if (time < totalDuration) {
        return i;
      }
    }
    return this.clips.length - 1;
  }

  getClipStartEnd(index) {
    // Add up the durations of the clips before the index
    let clipStart = 0;
    for (let i = 0; i < index; i++) {
      clipStart += this.getDurationOfClipMinusCuts(i);
    }
    let clipEnd = clipStart + this.getDurationOfClipMinusCuts(index);
    return [clipStart, clipEnd];
  }

  getDurationOfClipsMinusCuts() {
    // Get the duration of all the clips
    let duration = 0;
    for (let i = 0; i < this.clips.length; i++) {
      let clip = this.clips[i];
      duration += this.clips[i].duration;
      // Subtract the duration of any cut spans if there are any.
      for (let j = 0; j < this.cutSpans.length; j++) {
        let cutSpan = this.cutSpans[j];
        if (cutSpan.clipIndex === i) {
          duration -= cutSpan.outpoint - cutSpan.inpoint;
        }
      }
    }
    return duration; // This is placeholder code. Replace it with the actual duration of the clips.
  }

  getDurationOfClipMinusCuts(index) {
    if (index < 0 || index >= this.clips.length) return 0;
    let clip = this.clips[index];
    let duration = clip.duration;
    for (let i = 0; i < this.cutSpans.length; i++) {
      let cutSpan = this.cutSpans[i];
      if (cutSpan.clipIndex === index) {
        duration -= cutSpan.outpoint - cutSpan.inpoint;
      }
    }
    return duration;
  }

  getInpointOutpointFromSelection() {
    if (this.selectingState !== SelectionState.selectionMade) throw 'You must select a span of time before getting the inpoint.';
    let inpoint = this.selectionStart;
    let outpoint = this.selectionEnd;
    // Get the start of the selected clip.
    let clipStart = 0;
    for (let i = 0; i < this.selectedClipIndex; i++) {
      clipStart += this.getDurationOfClipMinusCuts(i);
    }
    // Get the duration of the cuts belonging to the selected clip before the inpoint.
    let cutDuration = 0;
    for (let i = 0; i < this.cutSpans.length; i++) {
      let cutSpan = this.cutSpans[i];
      if (cutSpan.clipIndex === this.selectedClipIndex && cutSpan.inpoint < inpoint) {
        cutDuration += cutSpan.outpoint - cutSpan.inpoint;
      }
    }
    // Inpoint and outpoint are relative to the start of the clip, so perform subtraction.
    inpoint -= clipStart;
    outpoint -= clipStart;
    // The selection does not factor in cuts, so add the cut duration to the inpoint and outpoint.
    inpoint += cutDuration;
    outpoint += cutDuration;
    return [inpoint, outpoint];
  }

  getJson() {
    return {
      clips: this.clips,
      cutSpans: this.cutSpans,
    };
  }

  getNormAtMouse(ev) {
    return (ev.clientX - this.timelineElement.offsetLeft) / this.timelineElement.offsetWidth;
  }

  getZoomedTimeSpan() {
    return this.timeSpanAtNormalZoom * this.zoom;
  }

  insertClip(clipname, duration, index) {
    if (index < 0 || index > this.clips.length) {
      alert('The index is out of range.');
      return;
    }
    let clip = {
      name: clipname,
      duration: duration
    };
    this.clips.splice(index, 0, clip);
    // Update the timeline
    this.clearSelection();
    this.updateClipIndexAndApparentStartAfterInsertingClip(index);
    this.updateWholeTimeline();
  }

  isCloseToSelectionStart(norm) {
    let start = this.timeToNorm(this.selectionStart);
    return Math.abs(norm - start) < 0.01;
  }

  isCloseToSelectionEnd(norm) {
    let end = this.timeToNorm(this.selectionEnd);
    return Math.abs(norm - end) < 0.01;
  }

  invokeWholeDurationChanged() {
    this.dispatchEvent(new Event('duration-changed'));
  }

  normToTime(norm) {
    return this.timeSpanStart + (norm * this.getZoomedTimeSpan());
  }

  onMouseDown(event) {
    if (this.clips.length === 0) return;
    let norm = this.getNormAtMouse(event);
    // If the mouse is close to the start of the selection, move the start
    if (this.isCloseToSelectionStart(norm)) {
      this.selectingState = SelectionState.movingStart;
      this.currentX = this.timeToNorm(this.selectionStart);
      this.downX = this.timeToNorm(this.selectionEnd);
    }
    // If the mouse is close to the end of the selection, move the end
    else if (this.isCloseToSelectionEnd(norm)) {
      this.selectingState = SelectionState.movingEnd;
      this.currentX = this.timeToNorm(this.selectionEnd);
      this.downX = this.timeToNorm(this.selectionStart);
    }
    // Otherwise, start a new selection
    else {
      this.selectingState = SelectionState.selecting;
      this.currentX = this.downX = norm;
      this.selectedClipIndex = this.getClipIndexAtNorm(norm);
      console.log('selectedClipIndex', this.selectedClipIndex);
    }
    // Set the upper and lower limits for the selection to the start and end of the selected clip, or the nearest cut.
    let [start, end] = this.getClipStartEnd(this.selectedClipIndex);
    this.upperLimit = this.timeToNorm(end);
    this.lowerLimit = this.timeToNorm(start);
    for (let i = 0; i < this.cutSpans.length; i++) {
      let cutSpan = this.cutSpans[i];
      let cutNorm = this.timeToNorm(cutSpan.apparentStart);
      if (cutNorm > this.lowerLimit && cutNorm < this.downX) {
        this.lowerLimit = cutNorm;
      } else if (cutNorm < this.upperLimit && cutNorm > this.downX) {
        this.upperLimit = cutNorm;
      }
    }
    this.showSelection(true);
    this.updateOngoingSelection();
  }

  onMouseMove(event) {
    let norm = this.getNormAtMouse(event);
    if (this.selectingState === SelectionState.notSelecting || this.selectingState === SelectionState.selectionMade) {
      // Highlight the start or end of the selection if the mouse is close to it
      if (this.isCloseToSelectionStart(norm) || this.isCloseToSelectionEnd(norm)) {
        this.timelineElement.style.cursor = 'ew-resize';
      } else {
        this.timelineElement.style.cursor = 'default';
      }
    } else {
      this.currentX = norm;
      this.updateOngoingSelection();
    }
  }

  onMouseUp(event) {
    if (this.selectingState !== SelectionState.notSelecting) {
      this.selectingState = SelectionState.selectionMade;
    }
    // Clear the selection if the start and end are the same.
    if (this.selectionStart === this.selectionEnd) {
      this.clearSelection();
    }
  }

  setJson(json) {
    this.clips = json.clips;
    this.cutSpans = json.cutSpans;
    this.updateWholeTimeline();
  }

  showSelection(show) {
    this.selectionElement.style.display = show ? 'block' : 'none';
  }

  timeToNorm(time) {
    return (time - this.timeSpanStart) / this.getZoomedTimeSpan();
  }

  updateApparentStartsOfCutsAfterDeletingCut(cutSpan) {
    // Update the apparent start of all the cuts after the given cut
    let idx = this.cutSpans.indexOf(cutSpan);
    if (idx === -1) throw 'Cut span not found';
    for (let i = idx + 1; i < this.cutSpans.length; i++) {
      this.cutSpans[i].apparentStart += cutSpan.outpoint - cutSpan.inpoint;
    }
    this.cutSpans.splice(idx, 1);
  }

  updateApparentStartsOfCutsAfterInsertingCut(cutSpan) {
    // Update the apparent start of all the cuts after the given cut
    let idx = this.cutSpans.indexOf(cutSpan);
    if (idx === -1) throw 'Cut span not found';
    for (let i = idx + 1; i < this.cutSpans.length; i++) {
      this.cutSpans[i].apparentStart -= cutSpan.outpoint - cutSpan.inpoint;
    }
  }

  updateClipIndexAndApparentStartAfterDeletingClip(clipIndex) {
    let duration = this.getDurationOfClipMinusCuts(clipIndex);
    for (let i = 0; i < this.cutSpans.length; i++) {
      let cutSpan = this.cutSpans[i];
      if (cutSpan.clipIndex > clipIndex) {
        cutSpan.clipIndex--;
        cutSpan.apparentStart -= duration;
      } else if (cutSpan.clipIndex === clipIndex) {
        this.cutSpans.splice(i, 1);
        i--;
      }
    }
    // Delete the clip
    this.clips.splice(clipIndex, 1);
  }

  updateClipIndexAndApparentStartAfterInsertingClip(clipIndex) {
    let clip = this.clips[clipIndex];
    for (let i = 0; i < this.cutSpans.length; i++) {
      let cutSpan = this.cutSpans[i];
      if (cutSpan.clipIndex >= clipIndex) {
        cutSpan.clipIndex++;
        cutSpan.apparentStart += clip.duration;
      }
    }
  }

  updateClips() {
    this.timeLineClipsElement.innerHTML = '';
    if (this.clips.length === 0) {
      this.noClipElement.style.display = 'block';
      return;
    } else {
      this.noClipElement.style.display = 'none';
    }
    // Get the index of the first and last clip that is visible
    let firstClipIndex = this.getClipIndexAtNorm(0);
    let lastClipIndex = this.getClipIndexAtNorm(1);
    // Add the clips to the timeline
    for (let i = firstClipIndex; i <= lastClipIndex; i++) {
      let clip = this.clips[i];
      let clipElement = document.createElement('div');
      clipElement.classList.add('clip');
      let [clipStart, clipEnd] = this.getClipStartEnd(i);
      let clipNormStart = this.timeToNorm(clipStart);
      let clipNormEnd = this.timeToNorm(clipEnd);
      // If the start or end of the clip is outside the timeline, clamp it to the timeline
      if (clipNormStart < 0) {
        clipNormStart = 0;
        clipElement.style.borderStartStartRadius = '0';
        clipElement.style.borderEndStartRadius = '0';
      }
      if (clipNormEnd > 1) {
        clipNormEnd = 1;
        clipElement.style.borderStartEndRadius = '0';
        clipElement.style.borderEndEndRadius = '0';
      }
      clipElement.style.left = (clipNormStart * 100) + '%';
      clipElement.style.width = ((clipNormEnd - clipNormStart) * 100) + '%';
      clipElement.innerHTML = `<p>${clip.name}</p>`;
      this.timeLineClipsElement.appendChild(clipElement);
    }
  }

  updateSelectionElementStyle(start, end) {
    // Clamp the start and end to the range 0-1
    start = Math.max(0, Math.min(1, start));
    end = Math.max(0, Math.min(1, end));
    // Set the left of box2 to the normalized x position of the mouse inside timeline
    this.selectionElement.style.left = (start * 100) + '%';
    // Set the width of box2 to the normalized width of the selection
    this.selectionElement.style.width = ((end - start) * 100) + '%';
  }

  updateSelectionStartEndElementInnerText() {
    this.selectionStartElement.innerText = this.selectionStart.toFixed(2);
    this.selectionEndElement.innerText = this.selectionEnd.toFixed(2);
  }

  updateOngoingSelection() {
    if (this.selectingState === SelectionState.notSelecting) return;
    let start, end;
    if (this.currentX < this.downX) {
      start = this.currentX;
      end = this.downX;
    } else {
      start = this.downX;
      end = this.currentX;
    }
    // Clamp the start and end to the range upperLimit-lowerLimit, not to exceed 0-1
    start = Math.max(0, this.lowerLimit, Math.min(1, start));
    end = Math.max(0, Math.min(1, this.upperLimit, end));
    this.updateSelectionElementStyle(start, end);

    // Update the selection start and end.
    this.selectionStart = this.timeSpanStart + (start * this.getZoomedTimeSpan());
    this.selectionEnd = this.timeSpanStart + (end * this.getZoomedTimeSpan());
    this.updateSelectionStartEndElementInnerText();
  }

  updateTimelineTicks() {
    this.timeLineTicksElement.innerHTML = '';
    // Get the zoom level range that the current zoom level falls into
    let zoomLevel = 0;
    for (let i = 0; i < this.zoomToTickSpan.levelThresholds.length; i++) {
      if (this.zoom > this.zoomToTickSpan.levelThresholds[i]) {
        zoomLevel = i + 1;
      }
    }
    // Get the span between ticks for the current zoom level
    let tickSpan = this.zoomToTickSpan.spanAtLevels[zoomLevel];
    // Get the first tick that is after timeSpanStart
    let firstTick = Math.ceil(this.timeSpanStart / tickSpan) * tickSpan;
    // Get the last tick that is before timeSpanEnd
    let lastTick = Math.floor(this.timeSpanEnd / tickSpan) * tickSpan;
    // Add a tick for each tick between the first and last ticks
    for (let tick = firstTick; tick <= lastTick; tick += tickSpan) {
      let tickNorm = this.timeToNorm(tick);
      let tickElement = document.createElement('div');
      tickElement.classList.add('timeline-tick');
      tickElement.style.left = (tickNorm * 100) + '%';
      // Increment the height of the tick while it is divisible by the current set of height changes
      let height = 1;
      for (let i = 0; i < this.zoomToTickSpan.heightChangesAtLevels[zoomLevel].length; i++) {
        if (tick % this.zoomToTickSpan.heightChangesAtLevels[zoomLevel][i] <= 0.03) {
          height++;
        }
      }
      // If the height is greater than 1, add the time to the tick's text
      if (height > 1) {
        tickElement.innerHTML = `<p>${tick.toFixed(0)}</p>`;
      }
      tickElement.style.height = (height * 10) + 'px';
      this.timeLineTicksElement.appendChild(tickElement);
    }
    // Add a tall red tick for each cut.
    for (let i = 0; i < this.cutSpans.length; i++) {
      let tickNorm = this.timeToNorm(this.cutSpans[i].apparentStart)
      if (tickNorm >= 0 && tickNorm <= 1) {
        let timelineTickCutElement = document.createElement('div');
        let timelineTickUncutElement = document.createElement('button');

        timelineTickCutElement.classList.add("timeline-tick-cut");
        timelineTickUncutElement.classList.add("uncut-btn");
        timelineTickUncutElement.innerHTML = "x";
        timelineTickUncutElement.addEventListener("click", (event) => {
          this.deleteCut(i);
          event.stopPropagation();
        });

        timelineTickCutElement.style.left = (tickNorm * 100) + '%';
        this.timeLineTicksElement.appendChild(timelineTickCutElement);
        timelineTickCutElement.appendChild(timelineTickUncutElement);
      }
    }
    // Add a tall green tick for the current play head position.
    let tickNorm = this.timeToNorm(this.playHeadTime);
    if (tickNorm > 0 && tickNorm < 1) {
      let timelineTickPlayHeadElement = document.createElement('div');
      timelineTickPlayHeadElement.classList.add("timeline-tick-playhead");
      timelineTickPlayHeadElement.style.left = (tickNorm * 100) + '%';
      this.timeLineTicksElement.appendChild(timelineTickPlayHeadElement);
    }
  }

  updateWholeTimeline() {
    this.timeSpanStartElement.innerText = this.timeSpanStart.toFixed(2);
    this.timeSpanEndElement.innerText = this.timeSpanEnd.toFixed(2);
    // Update selection by normalizing the selection start and end to the range 0-1
    let start = (this.selectionStart - this.timeSpanStart) / this.getZoomedTimeSpan();
    let end = (this.selectionEnd - this.timeSpanStart) / this.getZoomedTimeSpan();
    this.updateSelectionElementStyle(start, end);
    this.updateClips();
    this.updateTimelineTicks();
  }

  setZoom(value) {
    // Clamp value between 0 and 1
    value = Math.max(0, Math.min(1, value));
    this.zoom = this.zoomMin + ((1 - value) * (this.zoomMax - this.zoomMin));
    this.setTime(this.timeSpanStartNorm); // important for updating the timeline.
    this.updateWholeTimeline();
  }

  setTime(value) {
    // Clamp value between 0 and 1
    value = Math.max(0, Math.min(1, value));
    this.timeSpanStartNorm = value;
    if (this.getDurationOfClipsMinusCuts() < this.getZoomedTimeSpan()) {
      this.timeSpanStart = 0;
    } else {
      this.timeSpanStart = value * (this.getDurationOfClipsMinusCuts() - this.getZoomedTimeSpan());
    }
    this.timeSpanEnd = this.timeSpanStart + this.getZoomedTimeSpan();
    this.updateWholeTimeline();
  }

  setPlayHeadTime(value) {
    // Clamp value between 0 and whole timeline duration
    value = Math.max(0, Math.min(this.getDurationOfClipsMinusCuts(), value));
    this.playHeadTime = value;
    this.updateWholeTimeline();
  }
}
