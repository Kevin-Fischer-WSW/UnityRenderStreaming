﻿import {makeResizableDiv} from "./resizable-div.js";

export class CropWidget {
  constructor(bindingElement) {
    // The binding element is the element that the crop widget's position and size are bound to.
    this.bindingElement = bindingElement;
    this.mainElement = document.createElement("div");
    this.mainElement.classList.add("story-widget");
    this.mainElement.classList.add("resizable");
    this.mainElement.style.position = 'absolute';
    this.mainElement.style.top = '0px';
    this.mainElement.style.left = '0px';
    this.mainElement.innerHTML = `
            <div class='resizers'>
                <div class='story-content'></div>
                <div class='resizer top-left'></div>
                <div class='resizer top-right'></div>
                <div class='resizer bottom-left'></div>
                <div class='resizer bottom-right'></div>
            </div>`;
    // Make the main element draggable
    this.sX = 0;
    this.sY = 0;
    this.bX = 0;
    this.bY = 0;

    let upHandler = () => {
      window.removeEventListener('mousemove', moveHandler, true);
    }

    let downHandler = (e) => {
      e.preventDefault();
      window.addEventListener('mousemove', moveHandler, true);
      this.sX = parseInt(this.mainElement.style.left);
      this.sY = parseInt(this.mainElement.style.top);
      this.bX = this.sX - e.clientX;
      this.bY = this.sY - e.clientY;
    }

    let moveHandler = (e) => {
      e.preventDefault();
      this.mainElement.style.top = (e.clientY + this.bY) + 'px';
      this.mainElement.style.left = (e.clientX + this.bX) + 'px';
      this.boundCropPosition();
    }

    this.mainElement.addEventListener('mousedown', downHandler, false);
    window.addEventListener('mouseup', upHandler, false);
  }

  boundCropPosition() {
    let currentX = parseInt(this.mainElement.style.left);
    let currentY = parseInt(this.mainElement.style.top);
    let currentWidth = parseInt(this.mainElement.style.width);
    let currentHeight = parseInt(this.mainElement.style.height);
    let parentBoundingRect = this.bindingElement.parentElement.getBoundingClientRect();
    let boundingRect = this.bindingElement.getBoundingClientRect();
    let minX = boundingRect.left - parentBoundingRect.left;
    let minY = boundingRect.top - parentBoundingRect.top;
    let maxX = minX + boundingRect.width - currentWidth;
    let maxY = minY + boundingRect.height - currentHeight;
    currentX = Math.max(minX, currentX);
    currentY = Math.max(minY, currentY);
    currentX = Math.min(maxX, currentX);
    currentY = Math.min(maxY, currentY);
    this.mainElement.style.left = currentX + 'px';
    this.mainElement.style.top = currentY + 'px';
  }

  initResizers() {
    let getBoundingRect = () => {
      let parentBoundingRect = this.bindingElement.parentElement.getBoundingClientRect();
      let boundingRect = this.bindingElement.getBoundingClientRect();
      return new DOMRect(boundingRect.left - parentBoundingRect.left,
          boundingRect.top - parentBoundingRect.top,
          boundingRect.width,
          boundingRect.height);
    }
    makeResizableDiv(this.mainElement, this.mainElement.querySelectorAll('.resizer'), getBoundingRect);
  }

  reset() {
    let boundingRect = this.bindingElement.getBoundingClientRect();
    let parentBoundingRect = this.bindingElement.parentElement.getBoundingClientRect();
    let minX = boundingRect.left - parentBoundingRect.left;
    let minY = boundingRect.top - parentBoundingRect.top;
    this.mainElement.style.width = boundingRect.width + 'px';
    this.mainElement.style.height = boundingRect.height + 'px';
    this.mainElement.style.left = minX + 'px';
    this.mainElement.style.top = minY + 'px';
  }

  getNormalizedCrop() {
    let mainBoundingRect = this.mainElement.getBoundingClientRect();
    let boundingRect = this.bindingElement.getBoundingClientRect();
    let bottomNormalized = (boundingRect.bottom - mainBoundingRect.bottom) / boundingRect.height;
    let leftNormalized = (mainBoundingRect.left - boundingRect.left) / boundingRect.width;
    let widthNormalized = mainBoundingRect.width / boundingRect.width;
    let heightNormalized = mainBoundingRect.height / boundingRect.height;
    return {
      bottom: bottomNormalized,
      left: leftNormalized,
      width: widthNormalized,
      height: heightNormalized
    };
  }
}
