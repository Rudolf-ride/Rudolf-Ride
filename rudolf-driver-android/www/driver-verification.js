/* ==========================================================
   RUDOLF RIDE
   3R DRS-D — PHONE 2 DRIVER VERIFICATION
   Driver submission only — Admin controls review.
   ========================================================== */

(function () {
  "use strict";

  const DOCUMENTS = [
    ["ghanaCard", "verification-ghana-card", "verification-ghana-card-state", "ghana-card", "Ghana Card"],
    ["driverLicence", "verification-driver-licence", "verification-driver-licence-state", "driver-licence", "Driver's Licence"],
    ["vrc", "verification-vrc", "verification-vrc-state", "vehicle-registration", "Vehicle Registration / VRC"],
    ["insurance", "verification-insurance", "verification-insurance-state", "insurance", "Insurance"],
    ["roadworthy", "verification-roadworthy", "verification-roadworthy-state", "roadworthy", "Roadworthy Certificate"],
    ["driverPhoto", "verification-driver-photo", "verification-driver-photo-state", "driver-photo", "Driver Photo / Selfie"]
  ];

  let started = false;
  let currentRecord = null;

  function message(text) {
    const el = document.getElementById("driver-verification-message");
    if (el) el.textContent = text || "";
  }

  function statusOf(record) {
    if (!record || !record.submission || !record.submission.submittedAt) {
      return "not-submitted";
    }

    const review = record.review || {};
    const submitted = Date.parse(record.submission.submittedAt) || 0;
    const reviewed = Date.parse(review.reviewedAt || "") || 0;

    if (
      reviewed >= submitted &&
      (review.state === "approved" || review.state === "rejected")
    ) {
      return review.state;
    }

    return "pending";
  }

  function renderStatus(record) {
    const badge = document.getElementById("driver-verification-status");
    const button = document.getElementById("driver-verification-submit-btn");

    if (!badge) return;

    const status = statusOf(record);

    badge.className = "driver-verification-status";

    if (status === "approved") {
      badge.textContent = "Approved";
      badge.classList.add("verification-approved");

      if (button) {
        button.disabled = true;
        button.textContent = "✅ Verification Approved";
      }
    } else if (status === "rejected") {
      badge.textContent = "Rejected";
      badge.classList.add("verification-rejected");

      if (button) {
        button.disabled = false;
        button.textContent = "🛡️ Resubmit Verification";
      }
    } else if (status === "pending") {
      badge.textContent = "Pending";
      badge.classList.add("verification-pending");

      if (button) {
        button.disabled = false;
        button.textContent = "🛡️ Update Submission";
      }
    } else {
      badge.textContent = "Not submitted";
      badge.classList.add("verification-not-submitted");

      if (button) {
        button.disabled = false;
        button.textContent = "🛡️ Submit for Verification";
      }
    }
  }

  function renderDocuments(record) {
    const saved =
      record &&
      record.submission &&
      record.submission.documents
        ? record.submission.documents
        : {};

    const approved =
      statusOf(record) === "approved";

    DOCUMENTS.forEach(function (doc) {
      const key = doc[0];
      const input = document.getElementById(doc[1]);
      const state = document.getElementById(doc[2]);

      if (input) {
        input.disabled = approved;
      }

      if (!state) return;

      const item = saved[key];

      state.textContent =
        item && item.url
          ? "✅ Uploaded" + (item.name ? " — " + item.name : "")
          : "Not uploaded";
    });
  }

  function render(record) {
    currentRecord = record || null;
    renderStatus(currentRecord);
    renderDocuments(currentRecord);
  }

  function cleanFileName(name) {
    return String(name || "document")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 100);
  }

  function attachInputListeners() {
    DOCUMENTS.forEach(function (doc) {
      const input = document.getElementById(doc[1]);
      const state = document.getElementById(doc[2]);

      if (!input || !state) return;

      if (input.dataset.verificationBound === "yes") {
        return;
      }

      input.dataset.verificationBound = "yes";

      input.addEventListener("change", function () {
        const file =
          input.files && input.files[0]
            ? input.files[0]
            : null;

        if (!file) {
          renderDocuments(currentRecord);
          return;
        }

        if (file.size > 8 * 1024 * 1024) {
          alert(doc[4] + " is larger than 8 MB.");
          input.value = "";
          renderDocuments(currentRecord);
          return;
        }

        state.textContent =
          "📎 Selected — " + file.name;
      });
    });
  }

  async function submitDriverVerification() {
    try {
      const auth = window.rudolfDriverAuth;

      if (!auth || !auth.uid) {
        alert("Driver account is not ready yet.");
        return;
      }

      if (!window.rudolfCloud || !window.rudolfStorage) {
        alert("Firebase is not ready yet.");
        return;
      }

      if (statusOf(currentRecord) === "approved") {
        alert("Your verification is already approved.");
        return;
      }

      const button =
        document.getElementById(
          "driver-verification-submit-btn"
        );

      if (button) {
        button.disabled = true;
        button.textContent = "Preparing documents...";
      }

      message("Preparing your documents...");

      const oldDocuments =
        currentRecord &&
        currentRecord.submission &&
        currentRecord.submission.documents
          ? currentRecord.submission.documents
          : {};

      const documents =
        Object.assign({}, oldDocuments);

      let newFileCount = 0;

      for (const doc of DOCUMENTS) {
        const key = doc[0];
        const input = document.getElementById(doc[1]);
        const label = doc[4];

        const file =
          input &&
          input.files &&
          input.files[0]
            ? input.files[0]
            : null;

        if (!file) {
          if (!documents[key] || !documents[key].url) {
            throw new Error(
              "Please choose " + label + "."
            );
          }

          continue;
        }

        newFileCount += 1;

        message("Uploading " + label + "...");

        const path =
          "driver-verification/" +
          auth.uid +
          "/" +
          doc[3] +
          "/" +
          Date.now() +
          "-" +
          cleanFileName(file.name);

        const uploaded =
          await window.rudolfStorage.upload(
            path,
            file
          );

        documents[key] = uploaded;
      }

      if (
        currentRecord &&
        currentRecord.submission &&
        newFileCount === 0
      ) {
        throw new Error(
          "Choose at least one new document before resubmitting."
        );
      }

      let driverProfile = {};
      try {
        driverProfile = JSON.parse(localStorage.getItem("rudolfDriverProfile") || "{}");
      } catch (error) {
        driverProfile = {};
      }

      const submission = {
        driverUid: auth.uid,
        driverEmail: auth.email || "",
        driverName: driverProfile.name || "",
        driverPhone: localStorage.getItem("rudolfDriverContactPhone") || "",
        vehicle: driverProfile.vehicle || "",
        plate: driverProfile.plate || "",
        submittedAt: new Date().toISOString(),
        documents: documents
      };

      message("Sending for admin review...");

      await window.rudolfCloud.write(
        "rudolfDriverVerification/" +
        auth.uid +
        "/submission",
        submission
      );

      DOCUMENTS.forEach(function (doc) {
        const input =
          document.getElementById(doc[1]);

        if (input) {
          input.value = "";
        }
      });

      message(
        "✅ Documents submitted. Awaiting admin review."
      );

      alert(
        "✅ Verification submitted successfully.\n\nStatus: Pending"
      );

    } catch (error) {
      console.error(
        "Driver verification error:",
        error
      );

      message(
        "Submission issue: " +
        (
          error && error.message
            ? error.message
            : "Unknown error"
        )
      );

      alert(
        "Verification submission issue:\n" +
        (
          error && error.message
            ? error.message
            : "Unknown error"
        )
      );

      renderStatus(currentRecord);
    }
  }

  function startVerification() {
    if (started) return;

    if (
      !window.rudolfDriverAuth ||
      !window.rudolfDriverAuth.uid ||
      !window.rudolfCloud ||
      !window.rudolfStorage
    ) {
      return;
    }

    started = true;

    attachInputListeners();

    const path =
      "rudolfDriverVerification/" +
      window.rudolfDriverAuth.uid;

    window.rudolfCloud.listen(
      path,
      function (record) {
        render(record);
      }
    );
  }

  window.submitDriverVerification =
    submitDriverVerification;

  window.addEventListener(
    "rudolfDriverAuthReady",
    startVerification
  );

  window.addEventListener(
    "rudolfCloudReady",
    startVerification
  );

  document.addEventListener(
    "DOMContentLoaded",
    function () {
      attachInputListeners();
      startVerification();
    }
  );

  setTimeout(
    startVerification,
    0
  );

})();
