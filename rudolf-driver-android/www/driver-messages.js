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
