export function SetActive(element, active){
    if(active){
        element.classList.add("active");
    }else{
        element.classList.remove("active");
    }
}

export function IterateListAndSetItemBold(listElement, predicate){
  // Iterate through the list's children.
  for (let i = 0; i < listElement.children.length; i++) {
    // Get the child.
    let child = listElement.children[i];
    // Check if the child is the selected item.
    if (predicate(child)) {
      // Make the child bold.
      child.firstChild.style.fontWeight = "bold";
    } else {
      // Make the child normal.
      child.firstChild.style.fontWeight = "normal";
    }
  }
}

export function ActivateButtonHelper(btn, active) {
  if (active) {
    btn.classList.remove("deactivated");
    btn.classList.add("activated");
  } else {
    btn.classList.remove("activated");
    btn.classList.add("deactivated");
  }
}
