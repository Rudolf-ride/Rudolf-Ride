(function () {
  "use strict";

  // ============================================
  // 3R DRS-D — LIVE DRIVER SECURITY SELFIE
  // Isolated from ride/GPS/availability systems.
  // ============================================

  const UPLOAD_URL =
    "https://paystack-backend-gamma.vercel.app/driver-verification-upload-url";

  const MAX_FILE_SIZE =
    8 * 1024 * 1024;

  let started = false;
  let currentSecurity = {};
  let stopSecurityListener = null;


  function element(id) {
    return document.getElementById(id);
  }


  function cleanFileName(name) {

    return String(
      name || "security-selfie.jpg"
    )
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-"
      )
      .replace(
        /^[-.]+|[-.]+$/g,
        ""
      ) ||
      "security-selfie.jpg";
  }


  function securityCard() {
    return element(
      "driver-security-card"
    );
  }


  function securityButton() {
    return element(
      "driver-security-selfie-btn"
    );
  }


  function securityInput() {
    return element(
      "driver-security-selfie-input"
    );
  }


  function securityMessage() {
    return element(
      "driver-security-message"
    );
  }


  function setMessage(text) {

    const node =
      securityMessage();

    if (node) {
      node.textContent =
        text || "";
    }
  }


  function requestIsWaiting() {

    const request =
      currentSecurity &&
      currentSecurity.request
        ? currentSecurity.request
        : null;

    const response =
      currentSecurity &&
      currentSecurity.response
        ? currentSecurity.response
        : null;

    if (
      !request ||
      request.status !== "pending" ||
      !request.requestId
    ) {
      return false;
    }

    if (
      response &&
      response.requestId ===
        request.requestId
    ) {
      return false;
    }

    return true;
  }


  function renderSecurityState() {

    const card =
      securityCard();

    if (!card) {
      return;
    }

    if (requestIsWaiting()) {

      card.style.display =
        "";

      setMessage(
        "Admin has requested a fresh live security selfie."
      );

    } else {

      card.style.display =
        "none";
    }
  }


  async function preparePrivateUpload(
    auth,
    path,
    file
  ) {

    const token =
      await auth.getIdToken();

    if (!token) {
      throw new Error(
        "Driver authentication could not be verified."
      );
    }

    const type =
      String(
        file.type || ""
      )
        .trim()
        .toLowerCase();

    if (
      !type ||
      !type.startsWith("image/")
    ) {
      throw new Error(
        "Security selfie must be an image."
      );
    }

    const permissionResponse =
      await fetch(
        UPLOAD_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Authorization":
              "Bearer " + token
          },

          body: JSON.stringify({
            path: path,
            contentType: type,
            size: file.size
          })
        }
      );

    let permission = {};

    try {
      permission =
        await permissionResponse.json();
    } catch (error) {
      permission = {};
    }

    if (
      !permissionResponse.ok ||
      permission.success !== true ||
      !permission.uploadUrl
    ) {
      throw new Error(
        permission.message ||
        "Could not prepare secure selfie upload."
      );
    }

    return {
      permission: permission,
      type: type
    };
  }


  async function uploadSecuritySelfie(
    file
  ) {

    const auth =
      window.rudolfDriverAuth;

    const cloud =
      window.rudolfCloud;

    if (
      !auth ||
      !auth.uid ||
      typeof auth.getIdToken !==
        "function"
    ) {
      throw new Error(
        "Driver account is not ready."
      );
    }

    if (
      !cloud ||
      typeof cloud.write !==
        "function" ||
      typeof cloud.read !==
        "function"
    ) {
      throw new Error(
        "Secure cloud connection is not ready."
      );
    }

    if (!requestIsWaiting()) {
      throw new Error(
        "There is no active security selfie request."
      );
    }

    if (
      !file ||
      !file.size
    ) {
      throw new Error(
        "No security selfie was captured."
      );
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      throw new Error(
        "Security selfie is larger than 8 MB."
      );
    }

    const request =
      currentSecurity.request;

    const requestId =
      String(
        request.requestId || ""
      );

    const path =
      "driver-verification/" +
      auth.uid +
      "/security-selfie/" +
      Date.now() +
      "-" +
      cleanFileName(
        file.name
      );

    setMessage(
      "Uploading fresh security selfie..."
    );

    const prepared =
      await preparePrivateUpload(
        auth,
        path,
        file
      );

    const uploadResponse =
      await fetch(
        prepared.permission.uploadUrl,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              prepared.type
          },

          body: file
        }
      );

    if (!uploadResponse.ok) {
      throw new Error(
        "Secure security selfie upload failed."
      );
    }

    /*
     * Re-read the request before submitting.
     * This prevents an old capture from satisfying
     * a newer Admin request.
     */
    const latestRequest =
      await cloud.read(
        "rudolfDriverVerification/" +
        auth.uid +
        "/security/request"
      );

    if (
      !latestRequest ||
      latestRequest.status !== "pending" ||
      String(
        latestRequest.requestId || ""
      ) !== requestId
    ) {
      throw new Error(
        "The security request changed. Please capture a fresh selfie again."
      );
    }

    const now =
      new Date().toISOString();

    const selfie = {
      url:
        prepared.permission.blobUrl ||
        "",

      path:
        prepared.permission.path ||
        path,

      name:
        file.name ||
        "security-selfie.jpg",

      type:
        prepared.type,

      size:
        file.size || 0,

      uploadedAt:
        now
    };

    await cloud.write(
      "rudolfDriverVerification/" +
      auth.uid +
      "/security/response",
      {
        status:
          "submitted",

        requestId:
          requestId,

        driverUid:
          auth.uid,

        submittedAt:
          now,

        selfie:
          selfie
      }
    );

    setMessage(
      "✅ Security selfie submitted successfully."
    );
  }


  function bindControls() {

    const button =
      securityButton();

    const input =
      securityInput();

    if (
      !button ||
      !input
    ) {
      return;
    }

    button.addEventListener(
      "click",
      function () {

        if (!requestIsWaiting()) {
          setMessage(
            "There is no active security selfie request."
          );
          return;
        }

        /*
         * Clear previous selection so every Admin
         * request requires a new capture action.
         */
        input.value = "";
        input.click();
      }
    );


    input.addEventListener(
      "change",
      async function () {

        const file =
          input.files &&
          input.files[0]
            ? input.files[0]
            : null;

        if (!file) {
          return;
        }

        button.disabled = true;
        button.textContent =
          "Uploading...";

        try {

          await uploadSecuritySelfie(
            file
          );

        } catch (error) {

          console.error(
            "Live security selfie:",
            error
          );

          setMessage(
            "❌ " +
            (
              error.message ||
              "Security selfie submission failed."
            )
          );

        } finally {

          input.value = "";
          button.disabled = false;
          button.textContent =
            "📸 Take Security Selfie";
        }
      }
    );
  }




  /*
   * 3R DRS-D
   * Live Security Selfie 10-minute warning.
   *
   * Isolated from ride, GPS,
   * Online/Offline and popup logic.
   */
  const SECURITY_SELFIE_WARNING_MS =
    10 * 60 * 1000;


  function securityRequestDeadlinePassed() {

    const request =
      currentSecurity &&
      currentSecurity.request
        ? currentSecurity.request
        : null;


    if (
      !request ||
      request.status !== "pending" ||
      !request.requestedAt
    ) {
      return false;
    }


    const requestedAt =
      Date.parse(
        request.requestedAt
      );


    if (
      !Number.isFinite(
        requestedAt
      )
    ) {
      return false;
    }


    return (
      Date.now() - requestedAt >=
      SECURITY_SELFIE_WARNING_MS
    );
  }


  function applySecurityDeadlineWarning() {

    if (
      !requestIsWaiting() ||
      !securityRequestDeadlinePassed()
    ) {
      return;
    }


    const card =
      securityCard();

    const button =
      securityButton();


    /*
     * Do not overwrite upload progress.
     */
    if (
      button &&
      button.disabled
    ) {
      return;
    }


    if (card) {

      card.style.borderColor =
        "#dc2626";

      card.style.borderWidth =
        "3px";

    }


    setMessage(
      "⚠️ SECURITY WARNING: You have not answered Admin's live security selfie request within 10 minutes. Please take and submit the requested selfie immediately. Continued non-response may lead to account review."
    );


    if (button) {

      button.textContent =
        "⚠️ Take Security Selfie Now";

    }
  }


  let securityDeadlineMonitorStarted =
    false;


  function startSecurityDeadlineMonitor() {

    if (
      securityDeadlineMonitorStarted
    ) {
      return;
    }

    securityDeadlineMonitorStarted =
      true;


    applySecurityDeadlineWarning();


    setInterval(
      function () {

        applySecurityDeadlineWarning();

      },
      5000
    );
  }


  function startSecurityListener() {

    if (started) {
      return;
    }

    const auth =
      window.rudolfDriverAuth;

    const cloud =
      window.rudolfCloud;

    if (
      !auth ||
      !auth.uid ||
      !cloud ||
      typeof cloud.listen !==
        "function"
    ) {
      return;
    }

    started = true;

    bindControls();

    stopSecurityListener =
      cloud.listen(
        "rudolfDriverVerification/" +
        auth.uid +
        "/security",
        function (value) {

          currentSecurity =
            value || {};

          renderSecurityState();
        }
      );

    window.rudolfDriverSecurity = {
      refresh:
        renderSecurityState,

      stop:
        function () {

          if (
            typeof stopSecurityListener ===
            "function"
          ) {
            stopSecurityListener();
          }

          stopSecurityListener =
            null;

          started = false;
        }
    };
  }


  function waitForReady() {

    if (
      window.rudolfDriverAuth &&
      window.rudolfDriverAuth.uid &&
      window.rudolfCloud &&
      typeof window.rudolfCloud.listen ===
        "function"
    ) {
      startSecurityListener();

  startSecurityDeadlineMonitor();
      return;
    }

    setTimeout(
      waitForReady,
      250
    );
  }


  window.addEventListener(
    "rudolfDriverAuthReady",
    waitForReady
  );

  window.addEventListener(
    "rudolfCloudReady",
    waitForReady
  );

  waitForReady();

})();
