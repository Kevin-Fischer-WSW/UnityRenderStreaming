let counter = 0;
let activeAlerts = [];
let defaultParentElement = document.querySelector("body");

function createUserInputFeedbackAlert(parent, message, type) {
  // Check if there is already an alert with the same message.
  for (let i = 0; i < activeAlerts.length; i++) {
    if (activeAlerts[i].innerText.trim() === message) {
      return;
    }
  }
  // Create alert.
  counter += 1;
  let alert = document.createElement("div");
  activeAlerts.push(alert);
  alert.classList.add("alert");
  alert.classList.add("alert-" + type);
  alert.classList.add("alert-dismissible");
  alert.classList.add("fade");
  alert.classList.add("show");
  alert.classList.add("mt-2");
  alert.classList.add("mb-2");
  alert.classList.add("w-100");
  // Position alert in front of everything.
  alert.style.zIndex = "1000";

  alert.id = "alert-" + counter;
  // Pick icon based on type.
  let icon = "";
  switch (type) {
    case "success":
      icon = "check-circle";
      break;
    case "danger":
      icon = "exclamation-circle";
      break;
    case "warning":
      icon = "exclamation-triangle";
      break;
    case "info":
      icon = "info-circle";
      break;
    default:
      icon = "info-circle";
      break;
  }
  // Add dismiss button.
  alert.innerHTML =
    `<i class="bi-${icon}"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;
  // Add alert to the DOM.
  if (parent === null) {
    parent = defaultParentElement;
  }
  parent.appendChild(alert);
  bootstrap.Alert.getOrCreateInstance(alert)
  // Remove alert after 5 seconds.
  setTimeout(() => {
    // Remove alert from the DOM.
    let inst = bootstrap.Alert.getInstance(alert)
    inst.close()
  }, 5000);
  // Remove alert from the active alerts list.
  alert.addEventListener("closed.bs.alert", function () {
    let index = activeAlerts.indexOf(alert);
    if (index > -1) {
      activeAlerts.splice(index, 1);
    }
  });
}

export function alertDanger(message, parent = null) {
  createUserInputFeedbackAlert(parent, message, "danger");
}

export function alertSuccess(message, parent = null) {
  createUserInputFeedbackAlert(parent, message, "success");
}

export function alertWarning(message, parent = null) {
  createUserInputFeedbackAlert(parent, message, "warning");
}

export function alertInfo(message, parent = null) {
  createUserInputFeedbackAlert(parent, message, "info");
}

export function setDefaultParentElement(element) {
  defaultParentElement = element;
}
