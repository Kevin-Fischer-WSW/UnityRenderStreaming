export function selectHasOption(select, option) {
  return Array.from(select.options).some(o => o.value === option);
}

export function createOption(optionValue, optionInnerHTML) {
  const opt = document.createElement('option');
  opt.value = optionValue;
  opt.innerHTML = optionInnerHTML;
  return opt;
}
