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

  const PERSONAL_DOCUMENTS = DOCUMENTS.filter(function (doc) {
    return ["ghanaCard", "driverLicence", "driverPhoto"].includes(doc[0]);
  });

  const VEHICLE_DOCUMENTS = DOCUMENTS.filter(function (doc) {
    return ["vrc", "insurance", "roadworthy"].includes(doc[0]);
  });

  let started = false;
  let currentRecord = null;

  function message(text) {
    const el = document.getElementById("driver-verification-message");
    if (el) el.textContent = text || "";
  }

  function statusOf(record, section) {
    section = section === "vehicle" ? "vehicle" : "personal";
    const sub = record && record.submission ? record.submission : {};
    const field = section === "vehicle" ? "vehicleSubmittedAt" : "personalSubmittedAt";
    const submitted = Date.parse(sub[field] || "") || 0;
    if (!submitted) return "not-submitted";

    const root = record && record.review ? record.review : {};
    const review = root[section] || {};
    const reviewed = Date.parse(review.reviewedAt || "") || 0;

    if (reviewed >= submitted &&
        (review.state === "approved" || review.state === "rejected")) {
      return review.state;
    }
    return "pending";
  }

  function renderSectionStatus(record, section) {
    section = section === "vehicle" ? "vehicle" : "personal";

    const badge =
      document.getElementById(
        section + "-verification-status"
      );

    const button =
      document.getElementById(
        section + "-verification-submit-btn"
      );

    if (!badge) return;

    const status =
      statusOf(record, section);

    const name =
      section === "vehicle"
        ? "Vehicle"
        : "Personal";

    const icon =
      section === "vehicle"
        ? "🚗"
        : "🪪";

    badge.className =
      "driver-verification-status";

    if (status === "approved") {
      badge.textContent = "Approved";
      badge.classList.add(
        "verification-approved"
      );

      if (button) {
        button.disabled = false;
        button.textContent =
          "✏️ Update " + name + " Verification";
      }

    } else if (status === "rejected") {
      const reviewRoot =
        record && record.review
          ? record.review
          : {};

      const sectionReview =
        reviewRoot[section] || {};

      const rejectionReason =
        String(
          sectionReview.reason || ""
        ).trim();

      badge.textContent =
        rejectionReason
          ? "Rejected — Reason: " +
            rejectionReason
          : "Rejected";

      badge.classList.add(
        "verification-rejected"
      );

      if (button) {
        button.disabled = false;
        button.textContent =
          icon + " Resubmit " +
          name + " Verification";
      }

    } else if (status === "pending") {
      badge.textContent = "Pending";
      badge.classList.add(
        "verification-pending"
      );

      if (button) {
        button.disabled = false;
        button.textContent =
          icon + " Update " +
          name + " Verification";
      }

    } else {
      badge.textContent = "Not submitted";
      badge.classList.add(
        "verification-not-submitted"
      );

      if (button) {
        button.disabled = false;
        button.textContent =
          icon + " Submit " +
          name + " Verification";
      }
    }
  }


  function renderStatus(record) {
    renderSectionStatus(
      record,
      "personal"
    );

    renderSectionStatus(
      record,
      "vehicle"
    );
  }


  function renderDocuments(record) {
    const saved =
      record &&
      record.submission &&
      record.submission.documents
        ? record.submission.documents
        : {};

    const personalApproved =
      statusOf(
        record,
        "personal"
      ) === "approved";

    const vehicleApproved =
      statusOf(
        record,
        "vehicle"
      ) === "approved";

    DOCUMENTS.forEach(function (doc) {
      const key = doc[0];

      const input =
        document.getElementById(doc[1]);

      const state =
        document.getElementById(doc[2]);

      const isPersonal =
        PERSONAL_DOCUMENTS.some(
          function (item) {
            return item[0] === key;
          }
        );

      const approved =
        isPersonal
          ? personalApproved
          : vehicleApproved;

      if (input) {
        input.disabled = false;
      }

      if (!state) return;

      const item = saved[key];

      state.textContent =
        item && item.url
          ? "✅ Uploaded" +
            (
              item.name
                ? " — " + item.name
                : ""
            )
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

  // 3R DRS-D — Private Vercel Blob upload bridge.
  // Firebase RTDB remains the verification record/status store.
  const DRIVER_VERIFICATION_UPLOAD_URL =
    "https://paystack-backend-gamma.vercel.app/driver-verification-upload-url";


  function verificationContentType(file) {

    const supplied =
      String(
        file && file.type
          ? file.type
          : ""
      )
        .trim()
        .toLowerCase();

    if (
      supplied === "application/pdf" ||
      supplied.startsWith("image/")
    ) {
      return supplied;
    }

    const name =
      String(
        file && file.name
          ? file.name
          : ""
      ).toLowerCase();

    if (name.endsWith(".pdf")) {
      return "application/pdf";
    }

    if (
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg")
    ) {
      return "image/jpeg";
    }

    if (name.endsWith(".png")) {
      return "image/png";
    }

    if (name.endsWith(".webp")) {
      return "image/webp";
    }

    if (name.endsWith(".heic")) {
      return "image/heic";
    }

    if (name.endsWith(".heif")) {
      return "image/heif";
    }

    throw new Error(
      "Only image or PDF verification documents are supported."
    );
  }


  async function uploadVerificationDocument(
    auth,
    path,
    file
  ) {

    if (
      !auth ||
      typeof auth.getIdToken !== "function"
    ) {
      throw new Error(
        "Driver secure authentication is not ready."
      );
    }

    const idToken =
      await auth.getIdToken();

    if (!idToken) {
      throw new Error(
        "Driver authentication could not be verified."
      );
    }

    const contentType =
      verificationContentType(file);

    const permissionResponse =
      await fetch(
        DRIVER_VERIFICATION_UPLOAD_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Authorization":
              "Bearer " + idToken
          },

          body: JSON.stringify({
            path: path,
            contentType: contentType,
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
      !permission.success ||
      !permission.uploadUrl
    ) {
      throw new Error(
        permission.message ||
        "Could not prepare secure document upload."
      );
    }

    const uploadResponse =
      await fetch(
        permission.uploadUrl,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              contentType
          },

          body: file
        }
      );

    if (!uploadResponse.ok) {
      throw new Error(
        "Secure document upload failed."
      );
    }

    return {
      url:
        permission.blobUrl || "",

      path:
        permission.path || path,

      name:
        file.name,

      type:
        contentType,

      size:
        file.size || 0,

      uploadedAt:
        new Date().toISOString()
    };
  }


  async function submitDriverVerification(section) {
    section =
      section === "vehicle"
        ? "vehicle"
        : "personal";

    const sectionName =
      section === "vehicle"
        ? "Vehicle"
        : "Personal";

    const sectionDocuments =
      section === "vehicle"
        ? VEHICLE_DOCUMENTS
        : PERSONAL_DOCUMENTS;

    const submittedField =
      section === "vehicle"
        ? "vehicleSubmittedAt"
        : "personalSubmittedAt";

    try {
      const auth =
        window.rudolfDriverAuth;

      if (!auth || !auth.uid) {
        alert(
          "Driver account is not ready yet."
        );
        return;
      }

      if (
        !window.rudolfCloud ||
        typeof auth.getIdToken !== "function"
      ) {
        alert(
          "Driver secure upload is not ready yet."
        );
        return;
      }

      if (
        statusOf(
          currentRecord,
          section
        ) === "approved"
      ) {
        const confirmed = confirm(
          "Your " +
          sectionName.toLowerCase() +
          " verification is already approved. " +
          "Updating documents will send this section for review again. Continue?"
        );

        if (!confirmed) {
          return;
        }
      }

      const button =
        document.getElementById(
          section +
          "-verification-submit-btn"
        );

      if (button) {
        button.disabled = true;
        button.textContent =
          "Preparing documents...";
      }

      message(
        "Preparing " +
        sectionName.toLowerCase() +
        " verification documents..."
      );

      const oldSubmission =
        currentRecord &&
        currentRecord.submission
          ? currentRecord.submission
          : {};

      const oldDocuments =
        oldSubmission.documents || {};

      const documents =
        Object.assign(
          {},
          oldDocuments
        );

      let newFileCount = 0;

      for (const doc of sectionDocuments) {
        const key = doc[0];

        const input =
          document.getElementById(
            doc[1]
          );

        const label = doc[4];

        const file =
          input &&
          input.files &&
          input.files[0]
            ? input.files[0]
            : null;

        if (!file) {
          if (
            !documents[key] ||
            !documents[key].url
          ) {
            throw new Error(
              "Please choose " +
              label +
              "."
            );
          }

          continue;
        }

        newFileCount += 1;

        message(
          "Uploading " +
          label +
          "..."
        );

        const path =
          "driver-verification/" +
          auth.uid +
          "/" +
          doc[3] +
          "/" +
          Date.now() +
          "-" +
          cleanFileName(
            file.name
          );

        const uploaded =
          await uploadVerificationDocument(
            auth,
            path,
            file
          );

        documents[key] =
          uploaded;
      }

      const previousSubmitted =
        Date.parse(
          oldSubmission[
            submittedField
          ] || ""
        ) || 0;

      if (
        previousSubmitted &&
        newFileCount === 0
      ) {
        throw new Error(
          "Choose at least one new " +
          sectionName.toLowerCase() +
          " document before resubmitting."
        );
      }

      let driverProfile = {};

      try {
        driverProfile =
          JSON.parse(
            localStorage.getItem(
              "rudolfDriverProfile"
            ) || "{}"
          );
      } catch (error) {
        driverProfile = {};
      }

      const now =
        new Date().toISOString();

      const submission =
        Object.assign(
          {},
          oldSubmission,
          {
            driverUid:
              auth.uid,

            driverEmail:
              auth.email || "",

            driverName:
              driverProfile.name || "",

            driverPhone:
              localStorage.getItem(
                "rudolfDriverContactPhone"
              ) || "",

            vehicle:
              driverProfile.vehicle || "",

            plate:
              driverProfile.plate || "",

            submittedAt:
              now,

            documents:
              documents
          }
        );

      submission[
        submittedField
      ] = now;

      message(
        "Sending " +
        sectionName.toLowerCase() +
        " verification for admin review..."
      );

      await window.rudolfCloud.write(
        "rudolfDriverVerification/" +
        auth.uid +
        "/submission",
        submission
      );

      sectionDocuments.forEach(
        function (doc) {
          const input =
            document.getElementById(
              doc[1]
            );

          if (input) {
            input.value = "";
          }
        }
      );

      currentRecord =
        Object.assign(
          {},
          currentRecord || {},
          {
            submission:
              submission
          }
        );

      render(
        currentRecord
      );

      message(
        "✅ " +
        sectionName +
        " verification submitted. Awaiting admin review."
      );

      alert(
        "✅ " +
        sectionName +
        " verification submitted successfully.\n\nStatus: Pending"
      );

    } catch (error) {
      console.error(
        "Driver verification error:",
        error
      );

      message(
        "Submission issue: " +
        (
          error &&
          error.message
            ? error.message
            : "Unknown error"
        )
      );

      alert(
        sectionName +
        " verification submission issue:\n" +
        (
          error &&
          error.message
            ? error.message
            : "Unknown error"
        )
      );

      renderStatus(
        currentRecord
      );
    }
  }


  function startVerification() {
    if (started) return;

    if (
      !window.rudolfDriverAuth ||
      !window.rudolfDriverAuth.uid ||
      !window.rudolfCloud
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
