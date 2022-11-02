export function ValidateClonesWithJsonArray(cloneSource, cloneContainer, cloneArray, setupClone, jsonDataArray, validateClone){
  if (cloneArray.length < jsonDataArray.length) {
    while (cloneArray.length < jsonDataArray.length) {
      // Elements must be added.
      let clone = cloneSource.cloneNode(true);
      clone.id += "-" + cloneArray.length;
      cloneContainer.appendChild(clone);
      cloneArray.push(clone);
      setupClone(clone);
    }
  } else {
    while (cloneArray.length > jsonDataArray.length) {
      // Elements must be destroyed.
      cloneArray.pop().remove();
    }
  }
  // Validate data of each clone.
  for (let i = 0; i < jsonDataArray.length; i += 1) {
    validateClone(cloneArray[i], jsonDataArray[i]);
  }
}
