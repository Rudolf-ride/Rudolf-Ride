// 3R DRS-D — use the authenticated Driver identity
// already supplied by driver-auth-guard.js.
// No second Firebase Auth instance is required here.

const MODAL_ID = "driver-admin-message-modal";
const BACKDROP_ID = "driver-admin-message-backdrop";
const CLOSE_ID = "driver-admin-message-close";
const LIST_ID = "driver-admin-message-list";
const FORM_ID = "driver-admin-message-form";
const INPUT_ID = "driver-admin-message-input";
const STATUS_ID = "driver-admin-message-status";
const BUTTON_ID = "driver-message-admin-btn";

const MESSAGE_ROOT = "rudolfAdminDriverMessages";

let driverUid = null;
let unsubscribeMessages = null;

function getElement(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTime(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());

  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function setStatus(message, isError = true) {
  const status = getElement(STATUS_ID);
  if (!status) return;

  status.textContent = message || "";
  status.style.color = isError ? "#b91c1c" : "#166534";
}

function renderMessages(data) {
  const list = getElement(LIST_ID);
  if (!list) return;

  const messages = Object.entries(data || {})
    .map(([id, message]) => ({
      id,
      ...(message || {})
    }))
    .filter(message => message.text)
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));

  if (!messages.length) {
    list.innerHTML = `
      <div class="driver-admin-empty">
        No messages yet.<br>
        Start the conversation with Admin.
      </div>
    `;
    return;
  }

  list.innerHTML = messages.map(message => {
    const isOwn = message.sender === "driver";

    return `
      <div class="driver-admin-message ${isOwn
        ? "driver-admin-message-own"
        : "driver-admin-message-admin"}">
        <div class="driver-admin-message-label">
          ${isOwn ? "You" : "Admin"}
        </div>

        <div>${escapeHtml(message.text)}</div>

        <div class="driver-admin-message-time">
          ${escapeHtml(formatTime(message.createdAt))}
        </div>
      </div>
    `;
  }).join("");

  list.scrollTop = list.scrollHeight;
}

function stopMessageListener() {
  if (typeof unsubscribeMessages === "function") {
    unsubscribeMessages();
  }

  unsubscribeMessages = null;
}

function startMessageListener() {
  stopMessageListener();

  if (!driverUid) return;

  const cloud = window.rudolfCloud;

  if (!cloud || typeof cloud.listen !== "function") {
    setStatus("Cloud messaging is not ready yet.");
    return;
  }

  unsubscribeMessages = cloud.listen(
    `${MESSAGE_ROOT}/${driverUid}`,
    renderMessages
  );
}

function openModal() {
  const modal = getElement(MODAL_ID);
  if (!modal) return;

  modal.style.display = "block";
  setStatus("", false);

  startMessageListener();

  const input = getElement(INPUT_ID);
  if (input) {
    setTimeout(() => input.focus(), 50);
  }
}

function closeModal() {
  const modal = getElement(MODAL_ID);
  if (!modal) return;

  modal.style.display = "none";
  stopMessageListener();
}

async function sendMessage(event) {
  event.preventDefault();

  const input = getElement(INPUT_ID);
  if (!input) return;

  const text = input.value.trim();

  if (!text) return;

  if (!driverUid) {
    setStatus("Driver account is not ready.");
    return;
  }

  const cloud = window.rudolfCloud;

  if (!cloud || typeof cloud.write !== "function") {
    setStatus("Cloud messaging is not ready yet.");
    return;
  }

  try {
    const messageId =
      "driver-" +
      Date.now() +
      "-" +
      Math.random().toString(36).slice(2, 8);

    await cloud.write(
      `${MESSAGE_ROOT}/${driverUid}/${messageId}`,
      {
        sender: "driver",
        driverUid,
        text,
        createdAt: Date.now()
      }
    );

    input.value = "";
    setStatus("Sent.", false);

    setTimeout(() => setStatus("", false), 1200);
  } catch (error) {
    console.error("Driver → Admin message error:", error);
    setStatus("Message could not be sent.");
  }
}

function initializeButton() {
  const button = getElement(BUTTON_ID);

  if (!button) {
    console.warn("Message Admin button not found.");
    return;
  }

  button.addEventListener("click", openModal);
}

function initializeModal() {
  const closeButton = getElement(CLOSE_ID);
  const backdrop = getElement(BACKDROP_ID);
  const form = getElement(FORM_ID);

  if (closeButton) {
    closeButton.addEventListener("click", closeModal);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeModal);
  }

  if (form) {
    form.addEventListener("submit", sendMessage);
  }
}

function initializeDriverAdminMessaging() {
  const identity = window.rudolfDriverAuth;

  if (!identity || !identity.uid) {
    return false;
  }

  driverUid = identity.uid;

  initializeButton();
  initializeModal();

  console.log(
    "3R DRS-D Driver ↔ Admin messaging ready for Driver:",
    driverUid
  );

  return true;
}

if (!initializeDriverAdminMessaging()) {
  window.addEventListener(
    "rudolfDriverAuthReady",
    function () {
      initializeDriverAdminMessaging();
    },
    { once: true }
  );
}

console.log("3R DRS-D Driver ↔ Admin messaging module loaded.");
