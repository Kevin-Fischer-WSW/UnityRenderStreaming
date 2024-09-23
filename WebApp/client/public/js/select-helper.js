export function selectHasOption(select, option) {
  return Array.from(select.options).some(o => o.value === option);
}

export function createOption(optionValue, optionInnerHTML, tooltip = null) {
  const opt = document.createElement('option');
  opt.value = optionValue;
  opt.innerHTML = optionInnerHTML;
  if (tooltip) {
    opt.title = tooltip;
  }
  return opt;
}
