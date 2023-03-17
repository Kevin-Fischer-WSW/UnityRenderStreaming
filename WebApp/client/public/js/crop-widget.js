import {makeResizableDiv} from "./resizable-div.js";

export class CropWidget {
  constructor(bindingElement) {
    // The binding element is the element that the crop widget's position ans size are bound to.
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

    this._initResizers();

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
      this.boundCropPosition(this.bindingElement);
    }

    this.mainElement.addEventListener('mousedown', downHandler, false);
    window.addEventListener('mouseup', upHandler, false);
  }

  boundCropPosition(bindingElement) {
    let currentX = parseInt(this.mainElement.style.left);
    let currentY = parseInt(this.mainElement.style.top);
    let currentWidth = parseInt(this.mainElement.style.width);
    let currentHeight = parseInt(this.mainElement.style.height);
    let parentBoundingRect = bindingElement.parentElement.getBoundingClientRect();
    let boundingRect = bindingElement.getBoundingClientRect();
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

  boundCropSize(bindingElement) {
    let boundingRect = bindingElement.getBoundingClientRect();
    let mainBoundingRect = this.mainElement.getBoundingClientRect();
    let newRight = Math.min(mainBoundingRect.right, boundingRect.right);
    let newBottom = Math.min(mainBoundingRect.bottom, boundingRect.bottom);
    let newLeft = Math.max(mainBoundingRect.left, boundingRect.left);
    let newTop = Math.max(mainBoundingRect.top, boundingRect.top);
    this.mainElement.style.width = (newRight - newLeft) + 'px';
    this.mainElement.style.height = (newBottom - newTop) + 'px';
  }

  _initResizers() {
    makeResizableDiv(this.mainElement, this.mainElement.querySelectorAll('.resizer'));
    let resizers = document.querySelectorAll('.resizer');
    for (let i = 0; i < resizers.length; i++) {
      let currentResizer = resizers[i];
      currentResizer.addEventListener('mouseup', function (e) {
        this.boundCropSize(this.bindingElement);
        this.boundCropPosition(this.bindingElement);
      }.bind(this));
    }
  }

  reset() {
    // todo make the widget cover the whole image.
  }
}
