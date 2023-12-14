/*Make resizable div by Hung Nguyen*/
export function makeResizableDiv(element, resizers, getBoundingRect = null) {
    const minimum_size = 20;
    let original_width = 0;
    let original_height = 0;
    let original_x = 0;
    let original_y = 0;
    let original_mouse_x = 0;
    let original_mouse_y = 0;
    let original_ratio = 0;
    for (let i = 0;i < resizers.length; i++) {
        const currentResizer = resizers[i];
        currentResizer.addEventListener('mousedown', function(e) {
            e.preventDefault()
            e.stopPropagation()
            original_width = parseFloat(getComputedStyle(element, null).getPropertyValue('width').replace('px', ''));
            original_height = parseFloat(getComputedStyle(element, null).getPropertyValue('height').replace('px', ''));
            original_x = parseInt(getComputedStyle(element, null).getPropertyValue('left').replace('px', ''));
            original_y = parseInt(getComputedStyle(element, null).getPropertyValue('top').replace('px', ''));
            original_mouse_x = e.pageX;
            original_mouse_y = e.pageY;
            original_ratio = original_width / original_height;
            window.addEventListener('mousemove', resize)
            window.addEventListener('mouseup', stopResize)
        })

        function resize(e) {
            let maintain_ratio = !e.shiftKey;
            let bounding_rect = getBoundingRect ? getBoundingRect() : new DOMRect(0, 0, Infinity, Infinity);
            let mouse_x = e.pageX - original_mouse_x;
            let mouse_y = e.pageY - original_mouse_y;
            let mouse_x_bound = Math.min(Math.max(original_x + mouse_x, bounding_rect.x), bounding_rect.width);
            let mouse_y_bound = Math.min(Math.max(original_y + mouse_y, bounding_rect.y), bounding_rect.height);
            if (currentResizer.classList.contains('bottom-right')) {
                let width = original_width + (mouse_x)
                let height = original_height + (mouse_y)
                // Clamp the width and height.
                width = Math.min(Math.max(width, minimum_size), bounding_rect.x + bounding_rect.width - original_x);
                height = Math.min(Math.max(height, minimum_size), bounding_rect.y + bounding_rect.height - original_y);
                // Maintain the ratio.
                if (maintain_ratio) [width, height] = maintainRatioHelper(width, height);
                element.style.width = width + 'px';
                element.style.height = height + 'px'
            }
            else if (currentResizer.classList.contains('bottom-left')) {
                let width = original_width - (mouse_x)
                let height = original_height + (mouse_y)
                width = Math.min(Math.max(width, minimum_size), original_x + original_width - bounding_rect.x);
                height = Math.min(Math.max(height, minimum_size), bounding_rect.y + bounding_rect.height - original_y);
                if (maintain_ratio) [width, height] = maintainRatioHelper(width, height);
                element.style.width = width + 'px'
                element.style.height = height + 'px'
                // Set left to the change in width plus the original left.
                element.style.left = (original_x + (original_width - width)) + 'px';
            }
            else if (currentResizer.classList.contains('top-right')) {
                let width = original_width + (mouse_x)
                let height = original_height - (mouse_y)
                width = Math.min(Math.max(width, minimum_size), bounding_rect.x + bounding_rect.width - original_x);
                height = Math.min(Math.max(height, minimum_size), original_y + original_height - bounding_rect.y);
                if (maintain_ratio) [width, height] = maintainRatioHelper(width, height);
                element.style.width = width + 'px'
                element.style.height = height + 'px'
                // Set top to the change in height plus the original top.
                element.style.top = (original_y + (original_height - height)) + 'px';
            }
            else { // top-left
                let width = original_width - (mouse_x)
                let height = original_height - (mouse_y)
                width = Math.min(Math.max(width, minimum_size), original_x + original_width - bounding_rect.x);
                height = Math.min(Math.max(height, minimum_size), original_y + original_height - bounding_rect.y);
                if (maintain_ratio) [width, height] = maintainRatioHelper(width, height);
                element.style.width = width + 'px'
                element.style.height = height + 'px'
                element.style.left = (original_x + (original_width - width)) + 'px';
                element.style.top = (original_y + (original_height - height)) + 'px';
            }

            function maintainRatioHelper(width, height) {
                // Maintain the ratio
                let ratio = width / height;
                if (ratio > original_ratio) {
                  // Width is too big, so clamp it.
                  width = original_ratio * height;
                }
                else {
                  // Height is too big, so clamp it.
                  height = width / original_ratio;
                }
                return [width, height];
              }
        }

        function stopResize() {
            window.removeEventListener('mousemove', resize)
        }
    }
}
