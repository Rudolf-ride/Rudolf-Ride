(function () {
  const popup = document.createElement("div");

  popup.id = "rr-ride-popup";
  popup.innerHTML = `
    <div class="rr-popup-backdrop"></div>
    <section class="rr-popup-card">

      <div class="rr-popup-top">
        <div>
          <span class="rr-popup-badge">NEW RIDE REQUEST</span>
          <h2 class="rr-popup-title">Passenger Request</h2>
          <p id="rr-popup-status">Searching for driver</p>
        </div>
        <div class="rr-popup-bell">🔔</div>
      </div>

      <div class="rr-popup-route">
        <div class="rr-route-row">
          <span class="rr-route-dot rr-pickup"></span>
          <div>
            <small>PICKUP</small>
            <strong id="rr-popup-pickup">Waiting...</strong>
          </div>
        </div>

        <div class="rr-route-line"></div>

        <div class="rr-route-row">
          <span class="rr-route-dot rr-destination"></span>
          <div>
            <small>DESTINATION</small>
            <strong id="rr-popup-destination">Waiting...</strong>
          </div>
        </div>
      </div>

      <div class="rr-popup-info">
        <div>
          <small>RIDE TYPE</small>
          <strong id="rr-popup-type">Rudolf Ride</strong>
        </div>

        <div>
          <small>FARE</small>
          <strong id="rr-popup-fare">GH₵ 0.00</strong>
        </div>
      </div>

      <div class="rr-popup-actions">
        <button id="rr-popup-decline" type="button">Decline</button>
        <button id="rr-popup-accept" type="button">Accept Ride</button>
      </div>

    </section>
  `;

  document.body.appendChild(popup);

  const status = document.getElementById("ride-status");
  const pickup = document.getElementById("request-pickup");
  const destination = document.getElementById("request-destination");
  const fare = document.getElementById("request-fare");
  const type = document.getElementById("request-type");

  function hidePopup() {
    popup.classList.remove("rr-show");
    document.body.classList.remove("rr-popup-open");
  }

  function syncPopup() {
    if (!status) return;

    if (!isWaitingForDriver(status.textContent.trim())) {
      hidePopup();
      return;
    }

    document.getElementById("rr-popup-status").textContent =
      status.textContent.trim();

    document.getElementById("rr-popup-pickup").textContent =
      pickup ? pickup.textContent.trim() : "Not provided";

    document.getElementById("rr-popup-destination").textContent =
      destination ? destination.textContent.trim() : "Not provided";

    document.getElementById("rr-popup-fare").textContent =
      fare ? fare.textContent.trim() : "GH₵ 0.00";

    document.getElementById("rr-popup-type").textContent =
      type && type.textContent.trim()
        ? type.textContent.trim()
        : "Rudolf Ride";

    popup.classList.add("rr-show");
    document.body.classList.add("rr-popup-open");
  }

  document.getElementById("rr-popup-accept").onclick = function () {
    const button =
      document.querySelector("#ride-request .request-buttons .accept-btn");

    if (button) button.click();
    hidePopup();
  };

  document.getElementById("rr-popup-decline").onclick = function () {
    const button =
      document.querySelector("#ride-request .request-buttons .decline-btn");

    if (button) button.click();
    hidePopup();
  };

  const rideCard = document.getElementById("ride-request");

  if (rideCard) {
    new MutationObserver(syncPopup).observe(rideCard, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  syncPopup();
})();
