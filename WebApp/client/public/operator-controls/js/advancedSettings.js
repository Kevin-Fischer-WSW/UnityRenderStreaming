export function onEnableAdvancedSettings(toggle, defaultTab, ...args)
{
  if (toggle.checked) {
    for (let i = 0; i < args.length; i++) {
        args[i].classList.remove("d-none");
    }
  }
  else if (!toggle.checked) {
    defaultTab.click();
    for (let i = 0; i < args.length; i++) {
        args[i].classList.add("d-none");
    }
  }
}

