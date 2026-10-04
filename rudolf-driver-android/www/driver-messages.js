/*
========================================================
 RUDOLF RIDE — PHONE 2 DRIVER IN-BUILT MESSAGES
 3R-DPS-B ISOLATED MODULE
========================================================
*/

(function () {

  "use strict";

  const MESSAGE_PATH =
    "rudolfRideMessages/main";

  let listenerStarted = false;

  /*
   * 3R-DRSD-DRIVER-MESSAGE-TONE
   * Phone 2 only.
   *
   * Rules:
   * - First Firebase snapshot is silent history baseline.
   * - Driver's own messages never make a tone.
   * - Only newly appearing Passenger messages make a tone.
   */
  let messageSoundBaselineReady = false;
  const knownMessageIds = new Set();
  let driverMessageAudio = null;

  /*
   * 3R-DRSD-DRIVER-MESSAGE-VISUAL-ALERT
   * Phone 2 Driver only.
   *
   * - Red unread badge on Home > Messages.
   * - Compact Passenger-message popup.
   * - OPEN CHAT goes directly to Messages.
   * - Closing popup does NOT clear unread badge.
   * - Opening Messages clears unread badge.
   */
  let driverMessageUnreadCount = 0;
  let driverMessagePopupTimer = null;


  function getDriverMessagesHomeCard() {

    const cards =
      document.querySelectorAll(
        ".vehicle-info > div"
      );

    for (const card of cards) {

      const strong =
        card.querySelector("strong");

      if (
        strong &&
        strong.textContent.trim() ===
          "Messages"
      ) {
        return card;
      }

    }

    return null;

  }


  function isDriverMessagesOpen() {

    const section =
      document.getElementById(
        "driver-messages-section"
      );

    if (!section) {
      return false;
    }

    return (
      window.getComputedStyle(section)
        .display !== "none"
    );

  }


  function clearDriverMessageUnread() {

    driverMessageUnreadCount = 0;

    const badge =
      document.getElementById(
        "driver-message-unread-badge"
      );

    if (badge) {
      badge.textContent = "";
      badge.style.display = "none";
    }

  }


  function hideDriverMessagePopup() {

    if (driverMessagePopupTimer) {

      clearTimeout(
        driverMessagePopupTimer
      );

      driverMessagePopupTimer = null;

    }

    const popup =
      document.getElementById(
        "driver-message-popup"
      );

    if (popup) {
      popup.classList.remove(
        "is-visible"
      );
    }

  }


  function openDriverMessagesFromAlert() {

    clearDriverMessageUnread();
    hideDriverMessagePopup();

    if (
      typeof window.showDriverSection ===
        "function"
    ) {

      window.showDriverSection(
        "messages"
      );

    }

  }


  function ensureDriverMessageVisualAlert() {

    const card =
      getDriverMessagesHomeCard();

    if (card) {

      card.classList.add(
        "rr-driver-message-home-card"
      );

      let badge =
        document.getElementById(
          "driver-message-unread-badge"
        );

      if (!badge) {

        badge =
          document.createElement("span");

        badge.id =
          "driver-message-unread-badge";

        badge.className =
          "rr-driver-message-unread-badge";

        badge.setAttribute(
          "aria-label",
          "Unread passenger messages"
        );

        badge.style.display =
          "none";

        card.appendChild(badge);

      }


      if (
        !card.dataset
          .driverMessageReadHandler
      ) {

        card.dataset
          .driverMessageReadHandler =
            "1";

        card.addEventListener(
          "click",
          function () {

            clearDriverMessageUnread();
            hideDriverMessagePopup();

          }
        );

      }

    }


    let popup =
      document.getElementById(
        "driver-message-popup"
      );

    if (!popup) {

      popup =
        document.createElement("div");

      popup.id =
        "driver-message-popup";

      popup.className =
        "rr-driver-message-popup";

      popup.setAttribute(
        "role",
        "alert"
      );

      popup.setAttribute(
        "aria-live",
        "assertive"
      );


      const header =
        document.createElement("div");

      header.className =
        "rr-driver-message-popup-header";


      const title =
        document.createElement("strong");

      title.className =
        "rr-driver-message-popup-title";

      title.textContent =
        "💬 New message from Passenger";


      const closeButton =
        document.createElement(
          "button"
        );

      closeButton.type =
        "button";

      closeButton.className =
        "rr-driver-message-popup-close";

      closeButton.textContent =
        "×";

      closeButton.setAttribute(
        "aria-label",
        "Close message alert"
      );

      closeButton.addEventListener(
        "click",
        hideDriverMessagePopup
      );


      header.appendChild(title);
      header.appendChild(closeButton);


      const preview =
        document.createElement("div");

      preview.className =
        "rr-driver-message-popup-preview";


      const actions =
        document.createElement("div");

      actions.className =
        "rr-driver-message-popup-actions";


      const openButton =
        document.createElement(
          "button"
        );

      openButton.type =
        "button";

      openButton.className =
        "rr-driver-message-popup-open";

      openButton.textContent =
        "OPEN CHAT";

      openButton.addEventListener(
        "click",
        openDriverMessagesFromAlert
      );


      actions.appendChild(openButton);

      popup.appendChild(header);
      popup.appendChild(preview);
      popup.appendChild(actions);

      document.body.appendChild(popup);

    }


    const messagesSection =
      document.getElementById(
        "driver-messages-section"
      );

    if (
      messagesSection &&
      !messagesSection.dataset
        .driverMessageUnreadObserver
    ) {

      messagesSection.dataset
        .driverMessageUnreadObserver =
          "1";

      const observer =
        new MutationObserver(
          function () {

            if (
              isDriverMessagesOpen()
            ) {

              clearDriverMessageUnread();
              hideDriverMessagePopup();

            }

          }
        );

      observer.observe(
        messagesSection,
        {
          attributes: true,
          attributeFilter: [
            "style",
            "class"
          ]
        }
      );

    }

  }


  function showDriverMessageVisualAlert(
    message,
    arrivedCount
  ) {

    ensureDriverMessageVisualAlert();


    /*
     * If Driver is already inside Messages,
     * the message is considered seen.
     */
    if (isDriverMessagesOpen()) {

      clearDriverMessageUnread();
      hideDriverMessagePopup();

      return;

    }


    const count =
      Math.max(
        Number(arrivedCount) || 1,
        1
      );

    driverMessageUnreadCount +=
      count;


    const badge =
      document.getElementById(
        "driver-message-unread-badge"
      );

    if (badge) {

      badge.textContent =
        driverMessageUnreadCount > 99
          ? "99+"
          : String(
              driverMessageUnreadCount
            );

      badge.style.display =
        "flex";

    }


    const popup =
      document.getElementById(
        "driver-message-popup"
      );

    if (!popup) {
      return;
    }


    const preview =
      popup.querySelector(
        ".rr-driver-message-popup-preview"
      );

    if (preview) {

      preview.textContent =
        message &&
        message.text
          ? message.text
          : "New message received.";

    }


    popup.classList.add(
      "is-visible"
    );


    if (driverMessagePopupTimer) {

      clearTimeout(
        driverMessagePopupTimer
      );

    }


    driverMessagePopupTimer =
      setTimeout(
        hideDriverMessagePopup,
        7000
      );

  }



  function getDriverMessageAudio() {

    if (!driverMessageAudio) {

      driverMessageAudio =
        new Audio(
          "driver-chat-tone.mp3"
        );

      driverMessageAudio.preload =
        "auto";

      driverMessageAudio.volume =
        1.0;

    }

    return driverMessageAudio;

  }


  function playDriverMessageTone() {

    try {

      const audio =
        getDriverMessageAudio();

      audio.pause();
      audio.currentTime = 0;

      const playResult =
        audio.play();

      if (
        playResult &&
        typeof playResult.catch === "function"
      ) {

        playResult.catch(function (error) {

          console.warn(
            "Driver passenger-message tone unavailable:",
            error
          );

        });

      }

    } catch (error) {

      console.warn(
        "Driver passenger-message tone unavailable:",
        error
      );

    }

  }


  function handleDriverMessageSound(data) {

    const messages =
      normalizeMessages(data);


    /*
     * Initial Firebase load is HISTORY.
     * Remember it without making sound.
     */
    if (!messageSoundBaselineReady) {

      messages.forEach(function (message) {

        knownMessageIds.add(
          message.id
        );

      });

      messageSoundBaselineReady = true;

      return;
    }


    let passengerMessageArrived =
      false;

    let latestPassengerMessage =
      null;

    let newPassengerMessageCount =
      0;


    messages.forEach(function (message) {

      if (
        knownMessageIds.has(
          message.id
        )
      ) {
        return;
      }


      knownMessageIds.add(
        message.id
      );


      if (
        message.sender === "passenger"
      ) {

        passengerMessageArrived =
          true;

        latestPassengerMessage =
          message;

        newPassengerMessageCount +=
          1;

      }

    });


    if (passengerMessageArrived) {

      playDriverMessageTone();

      showDriverMessageVisualAlert(
        latestPassengerMessage,
        newPassengerMessageCount
      );

    }

  }


  function getMessageList() {
    return document.getElementById(
      "driver-message-list"
    );
  }


  function getStatusElement() {
    return document.getElementById(
      "driver-message-status"
    );
  }


  function setMessageStatus(text) {
    const element = getStatusElement();

    if (element) {
      element.textContent = text || "";
    }
  }


  function normalizeMessages(data) {

    if (!data || typeof data !== "object") {
      return [];
    }

    return Object.entries(data)
      .map(function ([id, message]) {

        if (
          !message ||
          typeof message !== "object"
        ) {
          return null;
        }

        return {
          id: id,
          sender:
            message.sender || "unknown",
          text:
            String(message.text || ""),
          createdAt:
            Number(message.createdAt || 0)
        };

      })
      .filter(Boolean)
      .filter(function (message) {
        return message.text.trim() !== "";
      })
      .sort(function (a, b) {
        return a.createdAt - b.createdAt;
      });

  }


  function formatMessageTime(timestamp) {

    if (!timestamp) {
      return "";
    }

    try {

      return new Date(timestamp)
        .toLocaleString();

    } catch (error) {

      return "";

    }

  }


  function renderDriverMessages(data) {

    const list =
      getMessageList();

    if (!list) {
      return;
    }

    const messages =
      normalizeMessages(data);

    list.innerHTML = "";

    if (messages.length === 0) {

      const empty =
        document.createElement("div");

      empty.className =
        "rr-message-empty";

      const icon =
        document.createElement("div");

      icon.textContent = "💬";

      const title =
        document.createElement("strong");

      title.textContent =
        "No messages yet";

      const text =
        document.createElement("p");

      text.textContent =
        "Your Rudolf Ride messages will appear here.";

      empty.appendChild(icon);
      empty.appendChild(title);
      empty.appendChild(text);

      list.appendChild(empty);

      return;
    }


    messages.forEach(function (message) {

      const row =
        document.createElement("div");

      const isDriver =
        message.sender === "driver";

      row.className =
        "rr-message-row " +
        (
          isDriver
            ? "rr-message-driver"
            : "rr-message-other"
        );


      const bubble =
        document.createElement("div");

      bubble.className =
        "rr-message-bubble";


      const body =
        document.createElement("div");

      body.className =
        "rr-message-text";

      body.textContent =
        message.text;


      const meta =
        document.createElement("small");

      meta.className =
        "rr-message-meta";

      meta.textContent =
        (
          isDriver
            ? "You"
            : "Passenger"
        ) +
        (
          message.createdAt
            ? " • " +
              formatMessageTime(
                message.createdAt
              )
            : ""
        );


      bubble.appendChild(body);
      bubble.appendChild(meta);

      row.appendChild(bubble);

      list.appendChild(row);

    });


    requestAnimationFrame(function () {

      list.scrollTop =
        list.scrollHeight;

    });

  }


  function startDriverMessageListener() {

    if (listenerStarted) {
      return true;
    }

    if (
      !window.rudolfCloud ||
      typeof window.rudolfCloud.listen !==
        "function"
    ) {
      return false;
    }

    window.rudolfCloud.listen(
      MESSAGE_PATH,
      function (data) {

        handleDriverMessageSound(data);

        renderDriverMessages(data);

      }
    );

    listenerStarted = true;

    return true;

  }


  async function sendDriverMessage(text) {

    if (
      !window.rudolfCloud ||
      typeof window.rudolfCloud.write !==
        "function"
    ) {
      throw new Error(
        "Cloud connection is not ready."
      );
    }

    const now =
      Date.now();

    const messageId =
      "driver-" +
      now +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 8);


    await window.rudolfCloud.write(
      MESSAGE_PATH + "/" + messageId,
      {
        sender: "driver",
        text: text,
        createdAt: now
      }
    );

  }


  function initializeDriverMessages() {

    const form =
      document.getElementById(
        "driver-message-form"
      );

    const input =
      document.getElementById(
        "driver-message-input"
      );

    if (!form || !input) {
      return;
    }


    ensureDriverMessageVisualAlert();


    if (!startDriverMessageListener()) {

      window.addEventListener(
        "rudolfCloudReady",
        function () {

          startDriverMessageListener();

        },
        {
          once: true
        }
      );

    }


    form.addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();

        const text =
          input.value.trim();

        if (!text) {
          return;
        }

        const sendButton =
          document.getElementById(
            "driver-message-send-btn"
          );

        try {

          if (sendButton) {
            sendButton.disabled = true;
          }

          setMessageStatus(
            "Sending..."
          );

          await sendDriverMessage(text);

          input.value = "";

          setMessageStatus(
            "Message sent"
          );


          setTimeout(function () {

            if (
              getStatusElement()?.textContent ===
              "Message sent"
            ) {
              setMessageStatus("");
            }

          }, 1800);


        } catch (error) {

          console.error(
            "Driver message failed:",
            error
          );

          setMessageStatus(
            "Message could not be sent."
          );

        } finally {

          if (sendButton) {
            sendButton.disabled = false;
          }

          input.focus();

        }

      }
    );

  }


  if (
    document.readyState === "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initializeDriverMessages
    );

  } else {

    initializeDriverMessages();

  }


  window.renderDriverMessages =
    renderDriverMessages;

})();
